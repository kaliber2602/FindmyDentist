# File: /services/_shared/security.py
# File này chứa tất cả logic bảo mật dùng chung

import jwt
from jwt import PyJWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyCookie
from pydantic import BaseModel, ValidationError
from passlib.context import CryptContext
from datetime import datetime, timedelta
import secrets # Dùng để tạo token reset an toàn

# === 1. CẤU HÌNH HASHING MẬT KHẨU ===
# Sử dụng bcrypt làm thuật toán hash
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# === 2. CẤU HÌNH JWT ===
# BẮT BUỘC: Hãy thay đổi chuỗi này thành một chuỗi bí mật của riêng bạn
SECRET_KEY = "your-super-secret-key-for-findmydentist-thay-doi-sau" 
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # Token hết hạn sau 1 ngày

# Tên của cookie mà chúng ta sẽ lưu token
COOKIE_NAME = "findmydentist_token" 

# === 3. PYDANTIC MODEL (Định nghĩa dữ liệu trong Token) ===
class TokenPayload(BaseModel):
    """
    Đây là dữ liệu (payload) được mã hóa bên trong JWT.
    """
    sub: str  # 'subject' (chủ thể) - chúng ta sẽ dùng user_id (VARCHAR)
    role: str # Vai trò (CUSTOMER, DENTIST, ADMIN)

# === 4. CÁC HÀM BẢO MẬT (Dùng trong routes.py) ===

def get_password_hash(password: str) -> str:
    """Hàm hash mật khẩu (dùng khi đăng ký)"""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Hàm kiểm tra mật khẩu (dùng khi đăng nhập)"""
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(user_id: str, role: str) -> str:
    """Tạo ra một JWT token mới"""
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {
        "sub": user_id,     # Lưu user_id vào token
        "role": role,       # Lưu vai trò vào token
        "exp": expire       # Đặt thời gian hết hạn
    }
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_reset_token() -> str:
    """Tạo một token reset ngẫu nhiên, an toàn (dùng cho reset password)"""
    return secrets.token_hex(32)

# === 5. DEPENDENCY BẢO VỆ API ===
# Đây là "người gác cổng" mà bạn sẽ đặt ở các API cần bảo vệ

# Định nghĩa cách lấy token: từ một cookie tên là COOKIE_NAME
cookie_scheme = APIKeyCookie(name=COOKIE_NAME, auto_error=False)

async def get_current_user(token: str = Depends(cookie_scheme)) -> TokenPayload:
    """
    Một dependency của FastAPI:
    1. Lấy token từ cookie (do trình duyệt tự động gửi).
    2. Nếu không có token, báo lỗi 401.
    3. Giải mã token.
    4. Trả về thông tin user (payload) hoặc báo lỗi 401.
    """
    if token is None:
        # Nếu không tìm thấy cookie, ném lỗi 401
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Chưa đăng nhập (Không tìm thấy cookie)",
        )
        
    try:
        # Giải mã token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        # Chuyển payload thành model Pydantic để xác thực
        token_data = TokenPayload(**payload)
        
    except PyJWTError:
        # Lỗi nếu token hết hạn, sai chữ ký...
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token không hợp lệ hoặc đã hết hạn",
        )
    except ValidationError:
        # Lỗi nếu payload thiếu 'sub' hoặc 'role'
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nội dung token không hợp lệ",
        )
    # Nếu mọi thứ OK, trả về payload (chứa user_id và role)
    return token_data