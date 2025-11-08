# File: /services/search_service/routes.py
from fastapi import APIRouter, Depends, Response
from .._shared.db import get_db_connection # Import hàm kết nối
import aiomysql

router = APIRouter()

@router.get("/clinics")
async def get_all_clinics(
    response: Response, 
    conn: aiomysql.Connection = Depends(get_db_connection) 
):
    """
    API này lấy tất cả phòng khám đã được xác thực
    để hiển thị trên trang 'find.html'
    """
    try:
        async with conn.cursor(aiomysql.cursors.DictCursor) as cursor:
            # Truy vấn CSDL 
            await cursor.execute(
                "SELECT clinic_id, name, address, description, images, average_rating "
                "FROM Clinics WHERE is_verified = TRUE"
            )
            clinics = await cursor.fetchall()
            return clinics
            
    except Exception as e:
        response.status_code = 500
        return {"error": "Lỗi truy vấn CSDL", "details": str(e)}

@router.get("/dentists/{dentist_id}")
async def get_dentist_details(
    dentist_id: str, # ID là VARCHAR 
    response: Response, 
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    """
    API này lấy chi tiết 1 nha sĩ
    để hiển thị trên trang 'dentist-detail.html'
    """
    try:
        async with conn.cursor(aiomysql.cursors.DictCursor) as cursor:
            # Truy vấn kết hợp bảng Users và Dentists 
            await cursor.execute(
                """
                SELECT 
                    u.user_id, u.first_name, u.last_name, u.email, u.phone_number,
                    d.specialization, d.bio, d.years_of_exp, d.average_rating
                FROM Users u
                JOIN Dentists d ON u.user_id = d.user_id
                WHERE u.user_id = %s
                """, 
                (dentist_id,)
            )
            dentist = await cursor.fetchone()
            
            if not dentist:
                response.status_code = 404
                return {"error": "Không tìm thấy nha sĩ"}
                
            return dentist
            
    except Exception as e:
        response.status_code = 500
        return {"error": "Lỗi truy vấn CSDL", "details": str(e)}