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
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# === 2. CẤU HÌNH JWT ===
SECRET_KEY = "your-super-secret-key-for-findmydentist-thay-doi-sau" 
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # Token hết hạn sau 1 ngày
COOKIE_NAME = "findmydentist_token" 

# === 3. PYDANTIC MODEL (Định nghĩa dữ liệu trong Token) (ĐÃ CẬP NHẬT) ===
class TokenPayload(BaseModel):
    """
    Đây là dữ liệu (payload) được mã hóa bên trong JWT.
    """
    sub: str  # 'subject' (chủ thể) - chúng ta sẽ dùng user_id (VARCHAR)
    role: str # Vai trò (CUSTOMER, DENTIST, ADMIN)
    is_verified: bool = False # (MỚI)
    is_ban: bool = False      # (MỚI)

# === 4. CÁC HÀM BẢO MẬT (Dùng trong routes.py) ===

def get_password_hash(password: str) -> str:
    """Hàm hash mật khẩu (dùng khi đăng ký)"""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Hàm kiểm tra mật khẩu (dùng khi đăng nhập)"""
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(user_id: str, role: str, is_verified: bool = False, is_ban: bool = False) -> str:
    """Tạo ra một JWT token mới (ĐÃ CẬP NHẬT)"""
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {
        "sub": user_id,
        "role": role,
        "is_verified": is_verified, # (MỚI)
        "is_ban": is_ban,           # (MỚI)
        "exp": expire
    }
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_reset_token() -> str:
    """Tạo một token reset ngẫu nhiên, an toàn (dùng cho reset password)"""
    return secrets.token_hex(32)

# === 5. DEPENDENCY BẢO VỆ API ===
cookie_scheme = APIKeyCookie(name=COOKIE_NAME, auto_error=False)

async def get_current_user(token: str = Depends(cookie_scheme)) -> TokenPayload:
    """
    Một dependency của FastAPI:
    (Logic giải mã không đổi, TokenPayload mới sẽ tự động xác thực các trường mới)
    """
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Chưa đăng nhập (Không tìm thấy cookie)",
        )
        
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        # Pydantic sẽ tự động xác thực các trường mới (is_verified, is_ban)
        token_data = TokenPayload(**payload)
        
    except PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token không hợp lệ hoặc đã hết hạn",
        )
    except ValidationError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nội dung token không hợp lệ (thiếu trường)",
        )
    
    return token_data