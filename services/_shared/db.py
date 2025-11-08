# File: /services/_shared/db.py
import aiomysql  # <-- THAY ĐỔI
from pydantic_settings import BaseSettings
import os

# 1. Đọc cấu hình từ file .env (Giữ nguyên)
class Settings(BaseSettings):
    DB_HOST: str
    DB_USER: str
    DB_PASSWORD: str
    DB_DATABASE: str
    class Config:
        env_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env')

settings = Settings()

# 2. Tạo hàm cung cấp kết nối CSDL (Dùng aiomysql)
async def get_db_connection():
    conn = None
    try:
        # --- THAY ĐỔI LỚN Ở ĐÂY ---
        conn = await aiomysql.connect(
            host=settings.DB_HOST,
            user=settings.DB_USER,
            password=settings.DB_PASSWORD,
            db=settings.DB_DATABASE,
            autocommit=True # Tự động commit
        )
        # ---------------------------
        yield conn # Cung cấp kết nối
    finally:
        if conn:
            conn.close() # Đóng kết nối