from fastapi import APIRouter, Depends, Response
from .._shared.db import get_db_connection # Import hàm kết nối
import aiomysql


router = APIRouter()
@router.get("/clinics")
async def get_all_clinics(response: Response, conn: aiomysql.Connection = Depends(get_db_connection)):
    """
    API này lấy tất cả phòng khám để hiển thị trên trang 'clinics.html'
    """
    try:
        async with conn.cursor(aiomysql.cursors.DictCursor) as cursor:
            # Truy vấn CSDL 
            await cursor.execute(
                """
                SELECT * FROM clinics
                """
            )
            clinics = await cursor.fetchall()
            return clinics
            
    except Exception as e:
        response.status_code = 500
        return {"error": "Lỗi truy vấn CSDL", "details": str(e)}
    
    
@router.get("/clinics/{clinic_id}")
async def get_clinic_details(clinic_id: int, response: Response, conn: aiomysql.Connection = Depends(get_db_connection)):
    """
    API này lấy chi tiết một phòng khám dựa trên clinic_id
    """
    try:
        async with conn.cursor(aiomysql.cursors.DictCursor) as cursor:
            # Truy vấn CSDL để lấy chi tiết phòng khám
            await cursor.execute(
                """
                SELECT 
                    c.clinic_id, c.name, c.address, c.phone_number,
                    d.first_name AS dentist_first_name, d.last_name AS dentist_last_name
                FROM clinics c
                JOIN dentists d ON c.dentist_id = d.user_id
                WHERE c.clinic_id = %s
                """,
                (clinic_id,)
            )
            clinic = await cursor.fetchone()
            
            if not clinic:
                response.status_code = 404
                return {"error": "Không tìm thấy phòng khám"}
                
            return clinic
            
    except Exception as e:
        response.status_code = 500
        return {"error": "Lỗi truy vấn CSDL", "details": str(e)}
    
@router.get("/clinics/dentist/{dentist_id}")
async def get_clinics_by_dentist(dentist_id: int, response: Response, conn: aiomysql.Connection = Depends(get_db_connection)):
    """
    API này lấy tất cả phòng khám của một nha sĩ dựa trên dentist_id
    """
    try:
        async with conn.cursor(aiomysql.cursors.DictCursor) as cursor:
            # Truy vấn CSDL để lấy các phòng khám của nha sĩ
            await cursor.execute(
                """
                SELECT 
                    clinic_id, name, address, phone_number
                FROM clinics
                WHERE dentist_id = %s
                """,
                (dentist_id,)
            )
            clinics = await cursor.fetchall()
            return clinics
            
    except Exception as e:
        response.status_code = 500
        return {"error": "Lỗi truy vấn CSDL", "details": str(e)}
    
@router.get("/dentists")
async def get_all_dentists(response: Response, conn: aiomysql.Connection = Depends(get_db_connection)):
    """
    API này lấy tất cả nha sĩ để hiển thị trên trang 'dentists.html'
    """
    try:
        async with conn.cursor(aiomysql.cursors.DictCursor) as cursor:
            # Truy vấn CSDL 
            await cursor.execute(
                """
                SELECT u.user_id, u.first_name, u.last_name, dentists.specialization, users.email, dentists.phone_number, dentists.years_of_exp, dentists.average_rating
                FROM dentists d, users u
                WHERE dentists.user_id = users.user_id
                """
            )
            dentists = await cursor.fetchall()
            return dentists
            
    except Exception as e:
        response.status_code = 500
        return {"error": "Lỗi truy vấn CSDL", "details": str(e)}