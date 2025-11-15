from fastapi import APIRouter, Depends, Response, status, HTTPException
from .._shared.db import get_db_connection 
import aiomysql
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime, timedelta
import uuid # Dùng để tạo VARCHAR ID

# Import các hàm bảo mật từ file dùng chung
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

class UserRegister(BaseModel):
    """
    Body dùng cho API /register
    Backend mong đợi 6 trường này:
    """
    email: EmailStr 
    password: str = Field(..., min_length=6) 
    first_name: str   
    last_name: str    
    phone_number: str 
    role: str 
    
    class Config:
        pass 


class UserLogin(BaseModel):
    """
    Body dùng cho API /login
    """
    email: EmailStr
    password: str

class ForgotPasswordRequest(BaseModel):
    """
    Body dùng cho API /request-reset
    """
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    """
    Body dùng cho API /reset-password
    """
    token: str # Token bí mật nhận được từ API /verify-otp
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
        # 1. Tìm user bằng email
        async with conn.cursor(aiomysql.DictCursor) as cursor:
            await cursor.execute(
                "SELECT user_id, email, role, password_hash FROM Users WHERE email = %s", 
                (form_data.email,)
            )
            user = await cursor.fetchone()

        
        # 2. Kiểm tra user và mật khẩu
        if not user or not verify_password(form_data.password, user["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, 
                detail="Email hoặc mật khẩu không chính xác"
            )
        
        # 3. Tạo JWT Token
        access_token = create_access_token(
            user_id=user["user_id"], 
            role=user["role"]
        )
        
        # 4. (QUAN TRỌNG) Đặt token vào HttpOnly Cookie
        response.set_cookie(
            key=COOKIE_NAME,     # Tên cookie (từ file security.py)
            value=access_token,  # Giá trị token
            httponly=True,       # <-- SỬA LỖI TẠI ĐÂY (từ 'httponply')
            samesite='none',      # (Bảo mật) Chống CSRF
            secure=False,        # (TODO) Đặt là True nếu dùng HTTPS
            max_age=60 * 60 * 24 # Hết hạn sau 1 ngày (giống token)
        )
        
        return {
            "user": {
                "user_id": user["user_id"],
                "email": user["email"],
                "role": user["role"]
            }
        }
    except Exception as e:
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
    # 1. Kiểm tra email đã tồn tại chưa
    async with conn.cursor() as cursor:
        await cursor.execute("SELECT user_id FROM Users WHERE email = %s", (user_data.email,))
        if await cursor.fetchone():
            raise HTTPException(status_code=400, detail="Email đã tồn tại")

    # 2. Hash mật khẩu
    hashed_password = get_password_hash(user_data.password)
    
    # 3. Tạo VARCHAR ID (vì CSDL không tự tăng)
    unique_part = uuid.uuid4().hex[:10]
    
    if user_data.role == 'CUSTOMER':
        new_user_id = f"cust_{unique_part}"
    elif user_data.role == 'DENTIST':
        new_user_id = f"dent_{unique_part}"

    try:
        # 4. Bắt đầu Transaction
        await conn.begin()
        
        # 5. INSERT vào bảng Users
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
            
            # 6. INSERT vào bảng con (Customer hoặc Dentist)
            if user_data.role == 'CUSTOMER':
                await cursor.execute(
                    "INSERT INTO Customers (user_id, is_verified) VALUES (%s, %s)",
                    (new_user_id, False) # Giả sử bắt đầu là chưa verified
                )
            elif user_data.role == 'DENTIST':
                 await cursor.execute(
                    "INSERT INTO Dentists (user_id, is_verified) VALUES (%s, %s)",
                    (new_user_id, False)
                )
            else:
                # Nếu role không hợp lệ (ví dụ: "ADMIN"), hủy transaction
                await conn.rollback()
                raise HTTPException(status_code=400, detail="Vai trò (role) không hợp lệ")
            
        # 7. Commit Transaction
        await conn.commit()
        
        response.status_code = status.HTTP_201_CREATED # 201 Created
        return {"message": "Đăng ký thành công", "user_id": new_user_id, "email": user_data.email}

    except Exception as e:
        await conn.rollback() # Hoàn tác nếu có lỗi
        response.status_code = 500
        return {"error": "Lỗi CSDL khi đăng ký", "details": str(e)}

@router.get(
    "/me",
    summary="Kiểm tra đăng nhập",
    description="API được bảo vệ. Dùng để kiểm tra token (cookie) có hợp lệ không. "
                "Nếu có, trả về thông tin user."
)
async def get_current_logged_in_user(
    # (BẢO VỆ) API này yêu cầu phải đăng nhập
    # get_current_user sẽ tự động đọc cookie và xác thực
    # Nếu token hợp lệ, current_user sẽ chứa (user_id, role)
    # Nếu không, nó sẽ tự động ném lỗi 401
    current_user: TokenPayload = Depends(get_current_user)
):
    # Nếu code chạy được đến đây, nghĩa là user đã đăng nhập
    return {
        "user_id": current_user.sub,
        "role": current_user.role
    }

# === 3. CÁC API RESET MẬT KHẨU ===

@router.post(
    "/request-reset",
    summary="Step 1: Yêu cầu reset mật khẩu",
    description="User gửi email. Server tạo OTP và token reset tạm thời, lưu vào CSDL."
)
async def request_password_reset(
    request: ForgotPasswordRequest, # <-- Body: Nhận email
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    """
    (File reset_password.js [cite: 58-62] gọi API này khi bấm 'Send OTP')
    """
    otp = "123456" # (DEMO) Tạo OTP ngẫu nhiên
    temp_reset_token = create_reset_token()
    expiry_time = datetime.utcnow() + timedelta(minutes=10) # Hết hạn sau 10p

    async with conn.cursor() as cursor:
        rows_affected = await cursor.execute(
            # (STATEFUL) Lưu token và thời hạn vào CSDL
            "UPDATE Users SET reset_token = %s, reset_expiry = %s WHERE email = %s",
            (temp_reset_token, expiry_time, request.email)
        )
    
    if rows_affected == 0:
        raise HTTPException(status_code=404, detail="Email không tìm thấy")
    
    # (TODO: Gửi email thật chứa 'otp' cho người dùng)
    
    return {
        "message": "Đã gửi OTP (demo)",
        "otp_for_demo": otp # (Chỉ cho demo, xóa khi production)
    }

@router.post(
    "/verify-otp",
    summary="Step 2: Xác thực OTP",
    description="User gửi OTP. Nếu đúng, server trả về token reset (dùng 1 lần)."
)
async def verify_reset_otp(
    request: BaseModel, # <-- Body: Nhận email và otp
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    """
    (File reset_password.js [cite: 58-62] gọi API này khi bấm 'Verify OTP')
    """
    # (Chuyển đổi data nhận được)
    email = request.email
    otp = request.otp
    
    # (DEMO) Bỏ qua việc kiểm tra OTP
    if otp != "123456":
         raise HTTPException(status_code=400, detail="OTP không chính xác")

    # Lấy token reset chúng ta đã lưu ở Step 1
    async with conn.cursor(aiomysql.DictCursor) as cursor:
        await cursor.execute(
            "SELECT reset_token, reset_expiry FROM Users WHERE email = %s",
            (email,)
        )
        user = await cursor.fetchone()
    
    if not user or not user["reset_token"] or user["reset_expiry"] < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Token reset không hợp lệ hoặc đã hết hạn")
    
    # Trả về token này, JS sẽ dùng nó cho bước cuối
    return {"message": "Xác thực thành công", "reset_token": user["reset_token"]}


@router.post(
    "/reset-password",
    summary="Step 3: Đặt mật khẩu mới",
    description="User gửi token (nhận ở step 2) và mật khẩu mới."
)
async def reset_password(
    request: ResetPasswordRequest, # <-- Body: Nhận token và new_password
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    """
    (File reset_password.js [cite: 58-62] gọi API này khi bấm 'Reset Password')
    """
    if not request.token:
        raise HTTPException(status_code=400, detail="Thiếu token reset")

    new_hashed_password = get_password_hash(request.new_password)
    
    async with conn.cursor() as cursor:
        # Cập nhật mật khẩu VÀ xóa token (để dùng 1 lần)
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