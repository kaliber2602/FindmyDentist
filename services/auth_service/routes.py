from fastapi import APIRouter, Depends, Response, status, HTTPException
from .._shared.db import get_db_connection 
import aiomysql
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime, timedelta
import uuid 

from .._shared.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_reset_token,
    get_current_user,
    TokenPayload,
    COOKIE_NAME
)

router = APIRouter()

# === 1. ĐỊNH NGHĨA CÁC BASEMODEL (INPUT/BODY CHUẨN) ===
# (Không thay đổi Pydantic models cho auth)

class UserRegister(BaseModel):
    email: EmailStr 
    password: str = Field(..., min_length=6) 
    first_name: str   
    last_name: str    
    phone_number: str 
    role: str 
    class Config:
        pass 

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str 
    new_password: str = Field(..., min_length=6)


# === 2. CÁC API AUTHENTICATION CHÍNH ===

@router.post(
    "/login",
    summary="Đăng nhập",
    description="Xác thực email/mật khẩu. Nếu thành công, trả về thông tin user "
                "và đặt một HttpOnly Cookie chứa JWT."
)
async def login_user(
    response: Response, 
    form_data: UserLogin, 
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    try:
        # 1. Tìm user bằng email (ĐÃ CẬP NHẬT Query)
        async with conn.cursor(aiomysql.DictCursor) as cursor:
            await cursor.execute(
                """
                SELECT user_id, email, role, password_hash, is_ban, is_verified 
                FROM Users WHERE email = %s
                """,
                (form_data.email,)
            )
            user = await cursor.fetchone()

        # 2. Kiểm tra user và mật khẩu
        if not user or not verify_password(form_data.password, user["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, 
                detail="Email hoặc mật khẩu không chính xác"
            )
        
        # (MỚI) Kiểm tra user có bị Ban không
        if user["is_ban"]:
             raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail="Tài khoản này đã bị khóa."
            )

        # 3. Tạo JWT Token (ĐÃ CẬP NHẬT)
        access_token = create_access_token(
            user_id=user["user_id"], 
            role=user["role"],
            is_verified=user["is_verified"], # (MỚI)
            is_ban=user["is_ban"]           # (MỚI)
        )
        
        # 4. Đặt token vào HttpOnly Cookie
        response.set_cookie(
            key=COOKIE_NAME,
            value=access_token,
            httponly=True,
            samesite='lax',
            secure=False,
            max_age=60 * 60 * 24 
        )
        
        # (ĐÃ CẬP NHẬT) Trả về trạng thái is_ban và is_verified
        return {
            "user": {
                "user_id": user["user_id"],
                "email": user["email"],
                "role": user["role"],
                "is_verified": user["is_verified"],
                "is_ban": user["is_ban"]
            }, "token": access_token
        }
    except Exception as e:
        # Phân biệt lỗi HTTP đã ném
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Lỗi máy chủ: {e}")

@router.post(
    "/logout",
    summary="Đăng xuất",
    description="Xóa HttpOnly cookie khỏi trình duyệt."
)
async def logout_user(response: Response):
    response.delete_cookie(key=COOKIE_NAME)
    return {"message": "Đăng xuất thành công"}

@router.post(
    "/register",
    summary="Đăng ký tài khoản mới",
    description="Tạo user mới trong bảng `Users` và bảng con (`Customers` hoặc `Dentists`)."
)
async def register_user(
    user_data: UserRegister, 
    response: Response,
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    async with conn.cursor() as cursor:
        await cursor.execute("SELECT user_id FROM Users WHERE email = %s", (user_data.email,))
        if await cursor.fetchone():
            raise HTTPException(status_code=400, detail="Email đã tồn tại")

    hashed_password = get_password_hash(user_data.password)
    unique_part = uuid.uuid4().hex[:10]
    
    if user_data.role == 'CUSTOMER':
        new_user_id = f"cust_{unique_part}"
    elif user_data.role == 'DENTIST':
        new_user_id = f"dent_{unique_part}"
    else:
        raise HTTPException(status_code=400, detail="Vai trò (role) không hợp lệ")

    try:
        await conn.begin()
        
        # 5. INSERT vào bảng Users (Thêm is_verified, is_ban, reputation_score đã có DEFAULT)
        async with conn.cursor() as cursor:
            await cursor.execute(
                """
                INSERT INTO Users 
                    (user_id, email, password_hash, first_name, last_name, phone_number, role)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (new_user_id, user_data.email, hashed_password, user_data.first_name, 
                 user_data.last_name, user_data.phone_number, user_data.role)
            )
            
            # 6. (ĐÃ CẬP NHẬT) INSERT vào bảng con (Bỏ is_verified)
            if user_data.role == 'CUSTOMER':
                await cursor.execute(
                    "INSERT INTO Customers (user_id) VALUES (%s)",
                    (new_user_id,)
                )
            elif user_data.role == 'DENTIST':
                 await cursor.execute(
                    "INSERT INTO Dentists (user_id) VALUES (%s)",
                    (new_user_id,)
                )
            
        await conn.commit()
        
        response.status_code = status.HTTP_201_CREATED
        return {"message": "Đăng ký thành công", "user_id": new_user_id, "email": user_data.email}

    except Exception as e:
        await conn.rollback()
        response.status_code = 500
        return {"error": "Lỗi CSDL khi đăng ký", "details": str(e)}

@router.get(
    "/me",
    summary="Kiểm tra đăng nhập",
    description="API được bảo vệ. Trả về thông tin user từ token (đã bao gồm is_ban, is_verified)."
)
async def get_current_logged_in_user(
    current_user: TokenPayload = Depends(get_current_user)
):
    # (ĐÃ CẬP NHẬT) Trả về các trường mới từ payload
    return {
        "user_id": current_user.sub,
        "role": current_user.role,
        "is_verified": current_user.is_verified,
        "is_ban": current_user.is_ban
    }

# === 3. CÁC API RESET MẬT KHẨU ===
# (Không thay đổi)

@router.post("/request-reset")
async def request_password_reset(
    request: ForgotPasswordRequest,
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    otp = "123456"
    temp_reset_token = create_reset_token()
    expiry_time = datetime.utcnow() + timedelta(minutes=10) 

    async with conn.cursor() as cursor:
        rows_affected = await cursor.execute(
            "UPDATE Users SET reset_token = %s, reset_expiry = %s WHERE email = %s",
            (temp_reset_token, expiry_time, request.email)
        )
    if rows_affected == 0:
        raise HTTPException(status_code=404, detail="Email không tìm thấy")
    
    return {"message": "Đã gửi OTP (demo)", "otp_for_demo": otp}

@router.post("/verify-otp")
async def verify_reset_otp(
    request: BaseModel,
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    email = getattr(request, 'email', None)
    otp = getattr(request, 'otp', None)
    
    if otp != "123456":
         raise HTTPException(status_code=400, detail="OTP không chính xác")

    async with conn.cursor(aiomysql.DictCursor) as cursor:
        await cursor.execute(
            "SELECT reset_token, reset_expiry FROM Users WHERE email = %s",
            (email,)
        )
        user = await cursor.fetchone()
    
    if not user or not user["reset_token"] or user["reset_expiry"] < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Token reset không hợp lệ hoặc đã hết hạn")
    
    return {"message": "Xác thực thành công", "reset_token": user["reset_token"]}


@router.post("/reset-password")
async def reset_password(
    request: ResetPasswordRequest,
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    if not request.token:
        raise HTTPException(status_code=400, detail="Thiếu token reset")

    new_hashed_password = get_password_hash(request.new_password)
    
    async with conn.cursor() as cursor:
        rows_affected = await cursor.execute(
            """
            UPDATE Users 
            SET password_hash = %s, reset_token = NULL, reset_expiry = NULL
            WHERE reset_token = %s AND reset_expiry > %s
            """,
            (new_hashed_password, request.token, datetime.utcnow())
        )
    
    if rows_affected == 0:
        raise HTTPException(status_code=400, detail="Token reset không hợp lệ hoặc đã hết hạn")

    return {"message": "Đã cập nhật mật khẩu thành công"}