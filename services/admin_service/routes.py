# File: /services/admin_service/routes.py (ĐÃ CẬP NHẬT MỤC 8 - LẤY SERVICES)
from fastapi import APIRouter, Depends, Response, status, HTTPException
from .._shared.db import get_db_connection 
import aiomysql
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid 
from datetime import datetime

# Import các hàm bảo mật từ file dùng chung
from .._shared.security import (
    get_current_user,
    TokenPayload,
    get_password_hash 
)

router = APIRouter()

# === 1. DEPENDENCY BẢO VỆ (CHỈ CHO ADMIN) ===
async def get_current_admin(current_user: TokenPayload = Depends(get_current_user)) -> TokenPayload:
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Không có quyền truy cập. Yêu cầu quyền Admin."
        )
    return current_user

admin_dependencies = [Depends(get_current_admin)]

# === 2. PYDANTIC MODELS ===

class AdminUserUpdateSchema(BaseModel):
    email: Optional[EmailStr] = None
    phone_number: Optional[str] = None
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    gender: Optional[str] = None 
    date_of_birth: Optional[str] = None 
    address: Optional[str] = None
    role: Optional[str] = None 
    new_password: Optional[str] = Field(None, min_length=6)
    reputation_score: Optional[int] = None
    is_ban: Optional[bool] = None
    is_verified: Optional[bool] = None

class ClinicSchema(BaseModel):
    name: str
    address: str
    phone_number: str
    email: str
    description: Optional[str] = None
    is_verified: bool = False
    reputation_score: Optional[int] = 100
    is_ban: Optional[bool] = False

class DentistDetailsSchema(BaseModel):
    first_name: str
    last_name: str
    phone_number: str
    specialization: Optional[str] = None
    bio: Optional[str] = None
    years_of_exp: int = Field(default=0, ge=0)
    is_verified: bool = False 

class AdminAppointmentUpdateSchema(BaseModel):
    appointment_datetime: datetime
    status: str
    notes: Optional[str] = None
    dentist_id: str
    clinic_id: str

class ReviewVerifySchema(BaseModel):
    is_verified: bool

# === 3. API CHO DASHBOARD ===
@router.get(
    "/dashboard-stats",
    summary="[READ] Lấy số liệu thống kê cho trang Dashboard",
    dependencies=admin_dependencies
)
async def get_dashboard_stats(
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    try:
        async with conn.cursor(aiomysql.DictCursor) as cursor:
            await cursor.execute("SELECT COUNT(*) AS count FROM Users")
            total_users = (await cursor.fetchone())['count']
            await cursor.execute("SELECT COUNT(*) AS count FROM Dentists")
            total_dentists = (await cursor.fetchone())['count']
            await cursor.execute("SELECT COUNT(*) AS count FROM Users WHERE role = 'DENTIST' AND is_verified = FALSE")
            pending_dentists = (await cursor.fetchone())['count']
            await cursor.execute("SELECT COUNT(*) AS count FROM Clinics WHERE is_verified = FALSE")
            pending_clinics = (await cursor.fetchone())['count']
            await cursor.execute("SELECT COUNT(*) AS count FROM Appointments WHERE status = 'Pending'")
            pending_bookings = (await cursor.fetchone())['count']
            await cursor.execute("SELECT COUNT(*) AS count FROM Reports WHERE status = 'Pending'")
            new_reports = (await cursor.fetchone())['count']
        return {
            "total_users": total_users,
            "total_dentists": total_dentists,
            "pending_verifications": pending_dentists + pending_clinics,
            "pending_bookings": pending_bookings,
            "new_reports": new_reports
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {e}")

# === 4. API DANH SÁCH CHỜ XÁC THỰC ===
@router.get(
    "/verification-queue",
    summary="[READ] Lấy danh sách chờ xác thực (Nha sĩ & Phòng khám)",
    dependencies=admin_dependencies
)
async def get_verification_queue(
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    try:
        async with conn.cursor(aiomysql.DictCursor) as cursor:
            await cursor.execute(
                """
                SELECT u.user_id, u.email, u.first_name, u.last_name, u.role, d.license_num
                FROM Users u
                JOIN Dentists d ON u.user_id = d.user_id
                WHERE u.is_verified = FALSE AND u.role = 'DENTIST'
                """
            )
            pending_dentists = await cursor.fetchall()
            await cursor.execute(
                """
                SELECT clinic_id, name, address, phone_number, email, 'CLINIC' AS role
                FROM Clinics 
                WHERE is_verified = FALSE
                """
            )
            pending_clinics = await cursor.fetchall()
        return {
            "pending_dentists": pending_dentists,
            "pending_clinics": pending_clinics
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {e}")

# === 5. USER MANAGEMENT ===
@router.get("/users", dependencies=admin_dependencies)
async def get_all_users(conn: aiomysql.Connection = Depends(get_db_connection)):
    try:
        async with conn.cursor(aiomysql.DictCursor) as cursor:
            await cursor.execute(
                """
                SELECT user_id, email, first_name, last_name, phone_number, role, 
                       created_at, is_verified, is_ban, reputation_score
                FROM Users 
                ORDER BY created_at DESC
                """
            )
            users = await cursor.fetchall()
        return users
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {e}")

@router.get("/users/{user_id}", dependencies=admin_dependencies)
async def get_user_by_id(user_id: str, conn: aiomysql.Connection = Depends(get_db_connection)):
    try:
        async with conn.cursor(aiomysql.DictCursor) as cursor:
            await cursor.execute(
                """
                SELECT user_id, email, phone_number, first_name, middle_name, 
                       last_name, gender, date_of_birth, address, role,
                       is_verified, is_ban, reputation_score
                FROM Users 
                WHERE user_id = %s
                """, (user_id,)
            )
            user = await cursor.fetchone()
            if not user:
                raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
            if user['role'] == 'CUSTOMER':
                await cursor.execute("SELECT * FROM Customers WHERE user_id = %s", (user_id,))
                user['details'] = await cursor.fetchone()
            elif user['role'] == 'DENTIST':
                await cursor.execute("SELECT * FROM Dentists WHERE user_id = %s", (user_id,))
                user['details'] = await cursor.fetchone()
        return user
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {e}")

@router.put("/users/{user_id}", dependencies=admin_dependencies)
async def admin_update_user(user_id: str, user_data: AdminUserUpdateSchema, conn: aiomysql.Connection = Depends(get_db_connection)):
    set_clauses = []
    values = []
    update_dict = user_data.dict(exclude_unset=True) 
    for key, value in update_dict.items():
        if key == 'new_password': continue 
        if key in ['middle_name', 'gender', 'date_of_birth', 'address'] and (value == "" or value is None):
            set_clauses.append(f"{key} = NULL")
        else:
            set_clauses.append(f"{key} = %s")
            values.append(value)
    if user_data.new_password:
        hashed_password = get_password_hash(user_data.new_password)
        set_clauses.append("password_hash = %s")
        values.append(hashed_password)
    if not set_clauses:
        return {"message": "Không có thông tin nào được gửi để cập nhật."}
    query = f"UPDATE Users SET {', '.join(set_clauses)} WHERE user_id = %s"
    values.append(user_id)
    try:
        async with conn.cursor() as cursor:
            rows_affected = await cursor.execute(query, tuple(values))
        if rows_affected == 0:
            raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
        await conn.commit()
        return {"message": "Cập nhật người dùng thành công", "user_id": user_id, "updated_fields": list(update_dict.keys())}
    except Exception as e:
        await conn.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL (đã rollback): {e}")

@router.delete("/users/{user_id}", dependencies=admin_dependencies)
async def delete_user(user_id: str, conn: aiomysql.Connection = Depends(get_db_connection)):
    try:
        async with conn.cursor() as cursor:
            rows_affected = await cursor.execute(
                "DELETE FROM Users WHERE user_id = %s AND role != 'ADMIN'", (user_id,)
            )
        if rows_affected == 0:
            raise HTTPException(status_code=404, detail="Không tìm thấy người dùng hoặc không thể xóa Admin")
        await conn.commit()
        return {"message": "Xóa người dùng thành công", "user_id": user_id}
    except Exception as e:
        await conn.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {e}")

# === 6. DENTIST MANAGEMENT ===
@router.get("/dentists", dependencies=admin_dependencies)
async def get_all_dentists(conn: aiomysql.Connection = Depends(get_db_connection)):
    try:
        async with conn.cursor(aiomysql.DictCursor) as cursor:
            await cursor.execute(
                """
                SELECT u.user_id, u.first_name, u.last_name, u.email, u.phone_number,
                       u.is_verified, u.is_ban, u.reputation_score,
                       d.specialization, d.bio, d.years_of_exp, d.license_num
                FROM Users u
                JOIN Dentists d ON u.user_id = d.user_id
                ORDER BY u.last_name
                """
            )
            dentists = await cursor.fetchall()
        return dentists
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {e}")

@router.put("/dentists/{user_id}", dependencies=admin_dependencies)
async def update_dentist_details(user_id: str, data: DentistDetailsSchema, conn: aiomysql.Connection = Depends(get_db_connection)):
    try:
        await conn.begin()
        async with conn.cursor() as cursor:
            await cursor.execute(
                """
                UPDATE Users 
                SET first_name = %s, last_name = %s, phone_number = %s, is_verified = %s
                WHERE user_id = %s AND role = 'DENTIST'
                """,
                (data.first_name, data.last_name, data.phone_number, data.is_verified, user_id)
            )
            rows_affected = await cursor.execute(
                """
                UPDATE Dentists 
                SET specialization = %s, bio = %s, years_of_exp = %s
                WHERE user_id = %s
                """,
                (data.specialization, data.bio, data.years_of_exp, user_id)
            )
        if rows_affected == 0:
            await conn.rollback()
            raise HTTPException(status_code=404, detail="Không tìm thấy Nha sĩ")
        await conn.commit()
        return {"message": "Cập nhật chi tiết nha sĩ thành công", "user_id": user_id}
    except Exception as e:
        await conn.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL (đã rollback): {e}")

# === 7. CLINIC MANAGEMENT ===
@router.post("/clinics", dependencies=admin_dependencies, status_code=status.HTTP_201_CREATED)
async def create_clinic(clinic_data: ClinicSchema, conn: aiomysql.Connection = Depends(get_db_connection)):
    new_clinic_id = f"clinic_{uuid.uuid4().hex[:10]}"
    try:
        async with conn.cursor() as cursor:
            await cursor.execute(
                """
                INSERT INTO Clinics (clinic_id, name, address, phone_number, email, 
                                     description, is_verified, reputation_score, is_ban)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (new_clinic_id, clinic_data.name, clinic_data.address, clinic_data.phone_number,
                 clinic_data.email, clinic_data.description, clinic_data.is_verified,
                 clinic_data.reputation_score, clinic_data.is_ban)
            )
        await conn.commit()
        return {"message": "Tạo phòng khám thành công", "clinic_id": new_clinic_id, **clinic_data.dict()}
    except Exception as e:
        await conn.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL (đã rollback): {e}")

@router.get("/clinics", dependencies=admin_dependencies)
async def get_all_clinics(conn: aiomysql.Connection = Depends(get_db_connection)):
    try:
        async with conn.cursor(aiomysql.DictCursor) as cursor:
            await cursor.execute("SELECT * FROM Clinics ORDER BY name")
            clinics = await cursor.fetchall()
        return clinics
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {e}")

@router.get("/clinics/{clinic_id}", dependencies=admin_dependencies)
async def get_clinic_by_id(clinic_id: str, conn: aiomysql.Connection = Depends(get_db_connection)):
    try:
        async with conn.cursor(aiomysql.DictCursor) as cursor:
            await cursor.execute("SELECT * FROM Clinics WHERE clinic_id = %s", (clinic_id,))
            clinic = await cursor.fetchone()
            if not clinic:
                raise HTTPException(status_code=404, detail="Không tìm thấy phòng khám")
        return clinic
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {e}")

@router.put("/clinics/{clinic_id}", dependencies=admin_dependencies)
async def update_clinic(clinic_id: str, clinic_data: ClinicSchema, conn: aiomysql.Connection = Depends(get_db_connection)):
    try:
        async with conn.cursor() as cursor:
            rows_affected = await cursor.execute(
                """
                UPDATE Clinics SET 
                    name = %s, address = %s, phone_number = %s, email = %s, 
                    description = %s, is_verified = %s, 
                    reputation_score = %s, is_ban = %s
                WHERE clinic_id = %s
                """,
                (clinic_data.name, clinic_data.address, clinic_data.phone_number,
                 clinic_data.email, clinic_data.description, clinic_data.is_verified,
                 clinic_data.reputation_score, clinic_data.is_ban, clinic_id)
            )
        if rows_affected == 0:
            raise HTTPException(status_code=404, detail="Không tìm thấy phòng khám")
        await conn.commit()
        return {"message": "Cập nhật phòng khám thành công", "clinic_id": clinic_id}
    except Exception as e:
        await conn.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL (đã rollback): {e}")

@router.delete("/clinics/{clinic_id}", dependencies=admin_dependencies)
async def delete_clinic(clinic_id: str, conn: aiomysql.Connection = Depends(get_db_connection)):
    try:
        async with conn.cursor() as cursor:
            rows_affected = await cursor.execute(
                "DELETE FROM Clinics WHERE clinic_id = %s", (clinic_id,)
            )
        if rows_affected == 0:
            raise HTTPException(status_code=404, detail="Không tìm thấy phòng khám")
        await conn.commit()
        return {"message": "Xóa phòng khám thành công", "clinic_id": clinic_id}
    except Exception as e:
        await conn.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL (đã rollback): {e}")

# === 8. APPOINTMENT MANAGEMENT (ĐÃ CẬP NHẬT TOÀN BỘ) ===

@router.get(
    "/appointments",
    summary="[READ] Lấy tất cả lịch hẹn (đã thêm tên clinic và services)",
    dependencies=admin_dependencies
)
async def get_all_appointments(
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    try:
        async with conn.cursor(aiomysql.DictCursor) as cursor:
            # 1. Lấy thông tin chính
            await cursor.execute(
                """
                SELECT a.*, 
                       c.first_name AS cust_first, c.last_name AS cust_last,
                       d.first_name AS dent_first, d.last_name AS dent_last,
                       cl.name AS clinic_name 
                FROM Appointments a
                LEFT JOIN Users c ON a.customer_id = c.user_id
                LEFT JOIN Users d ON a.dentist_id = d.user_id
                LEFT JOIN Clinics cl ON a.clinic_id = cl.clinic_id
                ORDER BY a.appointment_datetime DESC
                """
            )
            appointments = await cursor.fetchall()

            # (MỚI) 2. Lặp qua từng lịch hẹn để lấy dịch vụ
            for appt in appointments:
                await cursor.execute(
                    """
                    SELECT s.name
                    FROM Appointment_Services aps
                    JOIN Services s ON aps.service_id = s.service_id
                    WHERE aps.appointment_id = %s
                    """,
                    (appt['appointment_id'],)
                )
                services_result = await cursor.fetchall()
                # Gắn list tên dịch vụ vào object
                appt['services'] = [s['name'] for s in services_result] 

        return appointments
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {e}")

@router.get(
    "/appointments/{appointment_id}",
    summary="[READ] Lấy chi tiết 1 lịch hẹn (bao gồm dịch vụ)",
    dependencies=admin_dependencies
)
async def get_appointment_details(
    appointment_id: str,
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    try:
        async with conn.cursor(aiomysql.DictCursor) as cursor:
            await cursor.execute(
                "SELECT * FROM Appointments WHERE appointment_id = %s", (appointment_id,)
            )
            appointment = await cursor.fetchone()
            if not appointment:
                raise HTTPException(status_code=404, detail="Không tìm thấy lịch hẹn")

            await cursor.execute(
                """
                SELECT s.service_id, s.name 
                FROM Appointment_Services aps
                JOIN Services s ON aps.service_id = s.service_id
                WHERE aps.appointment_id = %s
                """, (appointment_id,)
            )
            services = await cursor.fetchall()
            appointment['services'] = services
            
        return appointment
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {e}")


@router.put(
    "/appointments/{appointment_id}",
    summary="[UPDATE] Cập nhật chi tiết lịch hẹn (Admin)",
    dependencies=admin_dependencies
)
async def update_appointment(
    appointment_id: str,
    appt_data: AdminAppointmentUpdateSchema, 
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    try:
        async with conn.cursor() as cursor:
            rows_affected = await cursor.execute(
                """
                UPDATE Appointments 
                SET status = %s, 
                    appointment_datetime = %s,
                    dentist_id = %s,
                    clinic_id = %s,
                    notes = %s
                WHERE appointment_id = %s
                """,
                (appt_data.status, appt_data.appointment_datetime, appt_data.dentist_id,
                 appt_data.clinic_id, appt_data.notes, appointment_id)
            )
        if rows_affected == 0:
            raise HTTPException(status_code=404, detail="Không tìm thấy lịch hẹn")
        await conn.commit()
        return {"message": f"Cập nhật lịch hẹn thành công", "appointment_id": appointment_id}
    except Exception as e:
        await conn.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL (đã rollback): {e}")

@router.delete(
    "/appointments/{appointment_id}",
    summary="[DELETE] Xóa một lịch hẹn",
    dependencies=admin_dependencies
)
async def delete_appointment(
    appointment_id: str,
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    try:
        async with conn.cursor() as cursor:
            rows_affected = await cursor.execute(
                "DELETE FROM Appointments WHERE appointment_id = %s", (appointment_id,)
            )
        if rows_affected == 0:
            raise HTTPException(status_code=404, detail="Không tìm thấy lịch hẹn")
        await conn.commit()
        return {"message": "Xóa lịch hẹn thành công", "appointment_id": appointment_id}
    except Exception as e:
        await conn.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL (đã rollback): {e}")

# === 9. REPORT & REVIEW MANAGEMENT ===

@router.get("/reviews", dependencies=admin_dependencies)
async def get_all_reviews(conn: aiomysql.Connection = Depends(get_db_connection)):
    try:
        async with conn.cursor(aiomysql.DictCursor) as cursor:
            await cursor.execute(
                """
                SELECT r.*, u.first_name, u.last_name 
                FROM Reviews r
                LEFT JOIN Users u ON r.customer_id = u.user_id
                ORDER BY r.created_at DESC
                """
            )
            reviews = await cursor.fetchall()
        return reviews
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {e}")

@router.put("/reviews/{review_id}", dependencies=admin_dependencies)
async def verify_review(review_id: str, review_data: ReviewVerifySchema, conn: aiomysql.Connection = Depends(get_db_connection)):
    try:
        async with conn.cursor() as cursor:
            rows_affected = await cursor.execute(
                "UPDATE Reviews SET is_verified = %s WHERE review_id = %s",
                (review_data.is_verified, review_id)
            )
        if rows_affected == 0:
            raise HTTPException(status_code=404, detail="Không tìm thấy đánh giá")
        await conn.commit()
        action = "xác thực" if review_data.is_verified else "ẩn"
        return {"message": f"Đã {action} đánh giá thành công", "review_id": review_id}
    except Exception as e:
        await conn.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL (đã rollback): {e}")

@router.delete("/reviews/{review_id}", dependencies=admin_dependencies)
async def delete_review(review_id: str, conn: aiomysql.Connection = Depends(get_db_connection)):
    try:
        async with conn.cursor() as cursor:
            rows_affected = await cursor.execute(
                "DELETE FROM Reviews WHERE review_id = %s", (review_id,)
            )
        if rows_affected == 0:
            raise HTTPException(status_code=404, detail="Không tìm thấy đánh giá")
        await conn.commit()
        return {"message": "Xóa đánh giá thành công", "review_id": review_id}
    except Exception as e:
        await conn.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL (đã rollback): {e}")

@router.get("/reports", dependencies=admin_dependencies)
async def get_all_reports(conn: aiomysql.Connection = Depends(get_db_connection)):
    try:
        async with conn.cursor(aiomysql.DictCursor) as cursor:
            await cursor.execute(
                """
                SELECT r.*, u.email AS reporter_email
                FROM Reports r
                LEFT JOIN Users u ON r.reporter_id = u.user_id
                ORDER BY r.created_at DESC
                """
            )
            reports = await cursor.fetchall()
        return reports
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {e}")

async def update_report_status(report_id: str, status: str, conn: aiomysql.Connection):
    try:
        async with conn.cursor() as cursor:
            rows_affected = await cursor.execute(
                "UPDATE Reports SET status = %s WHERE report_id = %s AND status = 'Pending'",
                (status, report_id)
            )
        if rows_affected == 0:
            raise HTTPException(status_code=404, detail=f"Không tìm thấy Report (ID: {report_id}) hoặc report đã được xử lý.")
        await conn.commit()
        return {"message": f"Report đã được {status}", "report_id": report_id}
    except Exception as e:
        await conn.rollback()
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {e}")

@router.post("/reports/{report_id}/resolve", dependencies=admin_dependencies)
async def resolve_report(report_id: str, conn: aiomysql.Connection = Depends(get_db_connection)):
    return await update_report_status(report_id, "Resolved", conn)

@router.post("/reports/{report_id}/dismiss", dependencies=admin_dependencies)
async def dismiss_report(report_id: str, conn: aiomysql.Connection = Depends(get_db_connection)):
    return await update_report_status(report_id, "Dismissed", conn)

    
# === 10. VERIFICATION APPROVAL ===
@router.post("/approve/dentist/{user_id}", dependencies=admin_dependencies)
async def approve_dentist(user_id: str, conn: aiomysql.Connection = Depends(get_db_connection)):
    try:
        async with conn.cursor() as cursor:
            rows_affected = await cursor.execute(
                "UPDATE Users SET is_verified = TRUE WHERE user_id = %s AND role = 'DENTIST'",
                (user_id,)
            )
        if rows_affected == 0:
            raise HTTPException(status_code=404, detail=f"Không tìm thấy Nha sĩ với ID: {user_id}")
        await conn.commit()
        return {"message": "Xác thực nha sĩ thành công", "user_id": user_id}
    except Exception as e:
        await conn.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {e}")

@router.post("/approve/clinic/{clinic_id}", dependencies=admin_dependencies)
async def approve_clinic(clinic_id: str, conn: aiomysql.Connection = Depends(get_db_connection)):
    try:
        async with conn.cursor() as cursor:
            rows_affected = await cursor.execute(
                "UPDATE Clinics SET is_verified = TRUE WHERE clinic_id = %s",
                (clinic_id,)
            )
        if rows_affected == 0:
            raise HTTPException(status_code=404, detail=f"Không tìm thấy Phòng khám với ID: {clinic_id}")
        await conn.commit()
        return {"message": "Xác thực phòng khám thành công", "clinic_id": clinic_id}
    except Exception as e:
        await conn.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {e}")