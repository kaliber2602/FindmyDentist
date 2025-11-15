from fastapi import APIRouter, Depends, Response
from .._shared.db import get_db_connection # Import hàm kết nối
import aiomysql

from pydantic import BaseModel
from .._shared.security import verify_password, get_password_hash
router = APIRouter()
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
                SELECT 
                    CONCAT('Dr. ', u.first_name, ' ', u.last_name) AS name,
                    d.specialization AS specialty,
                    SUBSTRING_INDEX(c.address, ',', -1) AS city,
                    c.name AS clinic,
                    c.clinic_id AS clinic_id,
                    d.user_id AS dentist_id,
                    d.average_rating AS rating,
                    COALESCE(s.name, 'General Dentistry') AS service,
                    u.role AS type,
                    JSON_UNQUOTE(JSON_EXTRACT(c.images, '$[0]')) AS image -- lấy ảnh đầu tiên trong JSON images
                FROM users u
                JOIN dentists d ON u.user_id = d.user_id
                LEFT JOIN clinic_dentists cd ON cd.dentist_id = d.user_id
                LEFT JOIN clinics c ON c.clinic_id = cd.clinic_id
                LEFT JOIN dentist_services ds ON ds.dentist_id = d.user_id
                LEFT JOIN services s ON s.service_id = ds.service_id
                WHERE u.role = 'DENTIST';
                """
            )
            dentists = await cursor.fetchall()
            
            return dentists
            
    except Exception as e:
        response.status_code = 500
        return {"error": "Lỗi truy vấn CSDL", "details": str(e)}
    
@router.get("/dentists/{dentist_id}")
async def get_dentist_by_id(dentist_id: int, response: Response, conn: aiomysql.Connection = Depends(get_db_connection)):
    """
    Lấy thông tin nha sĩ theo dentist_id
    """
    try:
        async with conn.cursor(aiomysql.cursors.DictCursor) as cursor:
            await cursor.execute(
                """
                SELECT 
                    u.first_name AS first_name,
                    u.last_name AS last_name,
                    d.specialization AS specialty,
                    d.years_of_exp AS years_of_experience,
                    d.bio AS bio,
                    d.average_rating AS rating,
                    u.email AS email,
                    u.phone_number AS phone_number
                FROM users u
                JOIN dentists d ON u.user_id = d.user_id
                WHERE d.user_id = %s;
                """,
                (dentist_id,)
            )
            dentist = await cursor.fetchone()
            if not dentist:
                response.status_code = 404
                return {"error": "Nha sĩ không tồn tại"}
            
            return dentist
            
    except Exception as e:
        response.status_code = 500
        return {"error": "Lỗi truy vấn CSDL", "details": str(e)}
    
    
@router.get("/dentists/{dentist_id}/clinics/")
async def get_clinics_by_dentist(dentist_id: int, response: Response, conn: aiomysql.Connection = Depends(get_db_connection)):
    """
    Lấy danh sách phòng khám mà nha sĩ làm việc
    """
    try:
        async with conn.cursor(aiomysql.cursors.DictCursor) as cursor:
            await cursor.execute(
                """
                SELECT 
                    c.clinic_id AS clinic_id,
                    c.name AS clinic_name,
                    c.address AS address,
                    SUBSTRING_INDEX(c.address, ',', -1) AS city,
                    JSON_UNQUOTE(JSON_EXTRACT(c.images, '$[0]')) AS image -- lấy ảnh đầu tiên trong JSON images
                FROM clinics c
                JOIN clinic_dentists cd ON cd.clinic_id = c.clinic_id
                WHERE cd.dentist_id = %s;
                """,
                (dentist_id,)
            )
            clinics = await cursor.fetchall()
            return clinics
            
    except Exception as e:
        response.status_code = 500
        return {"error": "Lỗi truy vấn CSDL", "details": str(e)}    
    
    
    
@router.get("/dentists/{dentist_id}/clinics/{clinic_id}/services/")
async def get_services_by_dentist_and_clinic(
    dentist_id: int, clinic_id: int, response: Response,
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    try:
        async with conn.cursor(aiomysql.cursors.DictCursor) as cursor:
            await cursor.execute(
                """
                SELECT 
                    s.service_id,
                    s.name AS service_name,
                    s.description,
                    s.min_price,
                    s.max_price,
                    s.expected_duration_minutes
                    
                FROM dentist_services ds
                JOIN services s ON s.service_id = ds.service_id
                JOIN clinic_dentists cd ON cd.dentist_id = ds.dentist_id
                JOIN clinic_services cs 
                        ON cs.service_id = s.service_id 
                        AND cs.clinic_id = cd.clinic_id
                WHERE ds.dentist_id = %s
                  AND cd.clinic_id = %s;
                """,
                (dentist_id, clinic_id)
            )
            services = await cursor.fetchall()
            return services

    except Exception as e:
        response.status_code = 500
        return {"error": "Lỗi truy vấn CSDL", "details": str(e)}
# ============================

class ServiceCreate(BaseModel):
    name: str
    description: str | None = None
    min_price: int
    max_price: int
    expected_duration_minutes: int


@router.post("/dentists/{dentist_id}/clinics/{clinic_id}/services/")
async def add_service_for_dentist_and_clinic(
    dentist_id: int,
    clinic_id: int,
    payload: ServiceCreate,
    response: Response,
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    try:
        async with conn.cursor() as cursor:

            # 1️⃣ Lấy service_id mới = MAX + 1
            await cursor.execute(
                "SELECT COALESCE(MAX(CAST(service_id AS UNSIGNED)), 0) + 1 FROM services"
            )
            service_id = (await cursor.fetchone())[0]


            # 2️⃣ Thêm service vào bảng services
            await cursor.execute(
                """
                INSERT INTO services 
                    (service_id, name, description, min_price, max_price, expected_duration_minutes)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    service_id,
                    payload.name,
                    payload.description,
                    payload.min_price,
                    payload.max_price,
                    payload.expected_duration_minutes,
                )
            )

            # 3️⃣ Gán dịch vụ cho dentist
            await cursor.execute(
                """
                INSERT INTO dentist_services (dentist_id, service_id)
                VALUES (%s, %s)
                """,
                (dentist_id, service_id)
            )

            # 4️⃣ Gán dịch vụ cho clinic
            await cursor.execute(
                """
                INSERT INTO clinic_services (clinic_id, service_id)
                VALUES (%s, %s)
                """,
                (clinic_id, service_id)
            )

            await conn.commit()

            return {
                "message": "Service created successfully",
                "service_id": service_id
            }

    except Exception as e:
        import traceback
        print("🔥🔥 SQL ERROR !!!")
        traceback.print_exc()
        response.status_code = 500
        return {"error": "Không thêm được dịch vụ", "details": str(e)}


class ServiceUpdate(BaseModel):
    name: str
    description: str | None = None
    min_price: int
    max_price: int
    expected_duration_minutes: int


@router.put("/dentists/{dentist_id}/clinics/{clinic_id}/services/{service_id}")
async def update_service(
    dentist_id: int,
    clinic_id: int,
    service_id: int,
    payload: ServiceUpdate,
    response: Response,
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    try:
        async with conn.cursor() as cursor:
            
            await cursor.execute(
                """
                UPDATE services
                SET name=%s,
                    description=%s,
                    min_price=%s,
                    max_price=%s,
                    expected_duration_minutes=%s
                WHERE service_id=%s
                """,
                (
                    payload.name,
                    payload.description,
                    payload.min_price,
                    payload.max_price,
                    payload.expected_duration_minutes,
                    service_id
                )
            )

            await conn.commit()

            return {"message": "Service updated successfully"}

    except Exception as e:
        import traceback
        print("🔥 ERROR:", traceback.format_exc())
        response.status_code = 500
        return {"error": "Không cập nhật được dịch vụ", "details": str(e)}


    
    
    
@router.delete("/dentists/{dentist_id}/clinics/{clinic_id}/services/{service_id}")
async def delete_service(
    dentist_id: int,
    clinic_id: int,
    service_id: int,
    response: Response,
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    try:
        async with conn.cursor() as cursor:

            await cursor.execute(
                "DELETE FROM clinic_services WHERE clinic_id=%s AND service_id=%s",
                (clinic_id, service_id)
            )

            await cursor.execute(
                "DELETE FROM dentist_services WHERE dentist_id=%s AND service_id=%s",
                (dentist_id, service_id)
            )

            await cursor.execute(
                "DELETE FROM services WHERE service_id=%s",
                (service_id,)
            )

            await conn.commit()

            return {"message": "Service deleted successfully"}

    except Exception as e:
        import traceback
        print("🔥 ERROR:", traceback.format_exc())
        response.status_code = 500
        return {"error": "Không xoá được dịch vụ", "details": str(e)}




class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str
    
@router.put("/dentists/{dentist_id}/change-password")
async def change_password(
    dentist_id: int,
    payload: ChangePasswordRequest,
    response: Response,
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    try:
        async with conn.cursor(aiomysql.cursors.DictCursor) as cursor:

            # 1️⃣ Lấy thông tin user từ bảng users
            await cursor.execute(
                "SELECT user_id, password_hash FROM users WHERE user_id = %s",
                (dentist_id,)
            )
            user = await cursor.fetchone()

            if not user:
                response.status_code = 404
                return {"error": "Không tìm thấy người dùng!"}

            # 2️⃣ Kiểm tra mật khẩu cũ có đúng không
            if not verify_password(payload.old_password, user["password_hash"]):
                response.status_code = 400
                return {"error": "Mật khẩu cũ không đúng!"}

            # 3️⃣ Hash mật khẩu mới
            new_hash = get_password_hash(payload.new_password)

            # 4️⃣ Cập nhật vào database
            await cursor.execute(
                """
                UPDATE users
                SET password_hash = %s
                WHERE user_id = %s
                """,
                (new_hash, dentist_id)
            )

            await conn.commit()

            return {"message": "Đổi mật khẩu thành công!"}

    except Exception as e:
        response.status_code = 500
        return {"error": "Lỗi server", "details": str(e)}
