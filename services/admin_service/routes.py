# File: /services/admin_service/routes.py
from fastapi import APIRouter, Depends, Response, status, HTTPException
from .._shared.db import get_db_connection 
import aiomysql
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid 

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

# === 2. PYDANTIC MODELS (Định nghĩa Body cho POST/PUT) ===

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

class ClinicSchema(BaseModel):
    name: str
    address: str
    phone_number: str
    email: str
    description: Optional[str] = None
    is_verified: bool = False

class DentistDetailsSchema(BaseModel):
    first_name: str
    last_name: str
    phone_number: str
    specialization: Optional[str] = None
    bio: Optional[str] = None
    years_of_exp: int = Field(default=0, ge=0)
    is_verified: bool = False

class AppointmentStatusSchema(BaseModel):
    status: str 

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
            # 1. Tổng Users (bao gồm cả admin)
            await cursor.execute("SELECT COUNT(*) AS count FROM Users")
            total_users = (await cursor.fetchone())['count']
            
            # 2. Tổng Dentists
            await cursor.execute("SELECT COUNT(*) AS count FROM Dentists")
            total_dentists = (await cursor.fetchone())['count']
            
            # 3. Yêu cầu xác thực (Nha sĩ + Phòng khám)
            await cursor.execute("SELECT COUNT(*) AS count FROM Dentists WHERE is_verified = FALSE")
            pending_dentists = (await cursor.fetchone())['count']
            await cursor.execute("SELECT COUNT(*) AS count FROM Clinics WHERE is_verified = FALSE")
            pending_clinics = (await cursor.fetchone())['count']
            
            # 4. Lịch hẹn đang chờ (Pending)
            await cursor.execute("SELECT COUNT(*) AS count FROM Appointments WHERE status = 'Pending'")
            pending_bookings = (await cursor.fetchone())['count']

            # (Giả lập vì chưa có bảng Reports)
            new_reports = 0 

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
            # Lấy nha sĩ chờ xác thực
            await cursor.execute(
                """
                SELECT u.user_id, u.email, u.first_name, u.last_name, u.role, d.license_num
                FROM Users u
                JOIN Dentists d ON u.user_id = d.user_id
                WHERE d.is_verified = FALSE
                """
            )
            pending_dentists = await cursor.fetchall()
            
            # Lấy phòng khám chờ xác thực
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

# === 5. USER MANAGEMENT (Quản lý Người dùng) ===

@router.get(
    "/users",
    summary="[READ] Lấy tất cả người dùng (Customers, Dentists, VÀ ADMINS)",
    dependencies=admin_dependencies
)
async def get_all_users(
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    try:
        async with conn.cursor(aiomysql.DictCursor) as cursor:
            await cursor.execute(
                """
                SELECT user_id, email, first_name, last_name, phone_number, role, created_at 
                FROM Users 
                ORDER BY created_at DESC
                """
            )
            users = await cursor.fetchall()
        return users
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {e}")

@router.get(
    "/users/{user_id}",
    summary="[READ] Lấy chi tiết 1 người dùng (bao gồm tất cả các trường)",
    dependencies=admin_dependencies
)
async def get_user_by_id(
    user_id: str,
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    try:
        async with conn.cursor(aiomysql.DictCursor) as cursor:
            await cursor.execute(
                """
                SELECT user_id, email, phone_number, first_name, middle_name, 
                       last_name, gender, date_of_birth, address, role 
                FROM Users 
                WHERE user_id = %s
                """,
                (user_id,)
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

@router.put(
    "/users/{user_id}",
    summary="[UPDATE] Cập nhật chi tiết người dùng (Admin)",
    dependencies=admin_dependencies
)
async def admin_update_user(
    user_id: str,
    user_data: AdminUserUpdateSchema,
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    set_clauses = []
    values = []
    
    update_dict = user_data.dict(exclude_unset=True)
    
    for key, value in update_dict.items():
        if key == 'new_password':
            continue 
        
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

@router.delete(
    "/users/{user_id}",
    summary="[DELETE] Xóa một người dùng",
    dependencies=admin_dependencies
)
async def delete_user(
    user_id: str,
    conn: aiomysql.Connection = Depends(get_db_connection)
):
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

@router.post(
    "/users/ban/{user_id}",
    summary="[UPDATE] Cấm (ban) một Customer",
    dependencies=admin_dependencies
)
async def ban_customer(
    user_id: str,
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    try:
        async with conn.cursor() as cursor:
            rows_affected = await cursor.execute(
                "UPDATE Customers SET ban_status = TRUE WHERE user_id = %s", (user_id,)
            )
        if rows_affected == 0:
            raise HTTPException(status_code=404, detail=f"Không tìm thấy Customer với ID: {user_id}")
        await conn.commit()
        return {"message": "Cấm (ban) người dùng thành công", "user_id": user_id}
    except Exception as e:
        await conn.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {e}")

@router.post(
    "/users/unban/{user_id}",
    summary="[UPDATE] Bỏ cấm (unban) một Customer",
    dependencies=admin_dependencies
)
async def unban_customer(
    user_id: str,
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    try:
        async with conn.cursor() as cursor:
            rows_affected = await cursor.execute(
                "UPDATE Customers SET ban_status = FALSE WHERE user_id = %s", (user_id,)
            )
        if rows_affected == 0:
            raise HTTPException(status_code=404, detail=f"Không tìm thấy Customer với ID: {user_id}")
        await conn.commit()
        return {"message": "Bỏ cấm người dùng thành công", "user_id": user_id}
    except Exception as e:
        await conn.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {e}")


# === 6. DENTIST MANAGEMENT (Quản lý chi tiết Nha sĩ) ===

@router.get(
    "/dentists",
    summary="[READ] Lấy tất cả nha sĩ (chi tiết)",
    dependencies=admin_dependencies
)
async def get_all_dentists(
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    try:
        async with conn.cursor(aiomysql.DictCursor) as cursor:
            await cursor.execute(
                """
                SELECT u.user_id, u.first_name, u.last_name, u.email, u.phone_number,
                       d.specialization, d.bio, d.years_of_exp, d.is_verified, d.license_num
                FROM Users u
                JOIN Dentists d ON u.user_id = d.user_id
                ORDER BY u.last_name
                """
            )
            dentists = await cursor.fetchall()
        return dentists
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {e}")

@router.put(
    "/dentists/{user_id}",
    summary="[UPDATE] Cập nhật chi tiết 1 nha sĩ (bảng Users và Dentists)",
    dependencies=admin_dependencies
)
async def update_dentist_details(
    user_id: str,
    data: DentistDetailsSchema,
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    try:
        await conn.begin()
        async with conn.cursor() as cursor:
            await cursor.execute(
                """
                UPDATE Users SET first_name = %s, last_name = %s, phone_number = %s
                WHERE user_id = %s
                """,
                (data.first_name, data.last_name, data.phone_number, user_id)
            )
            rows_affected = await cursor.execute(
                """
                UPDATE Dentists 
                SET specialization = %s, bio = %s, years_of_exp = %s, is_verified = %s
                WHERE user_id = %s
                """,
                (data.specialization, data.bio, data.years_of_exp, data.is_verified, user_id)
            )
        if rows_affected == 0:
            await conn.rollback()
            raise HTTPException(status_code=404, detail="Không tìm thấy Nha sĩ")
        await conn.commit()
        return {"message": "Cập nhật chi tiết nha sĩ thành công", "user_id": user_id}
    except Exception as e:
        await conn.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL (đã rollback): {e}")


# === 7. CLINIC MANAGEMENT (Quản lý Phòng khám) ===

@router.post(
    "/clinics",
    summary="[CREATE] Tạo một phòng khám mới",
    status_code=status.HTTP_201_CREATED,
    dependencies=admin_dependencies
)
async def create_clinic(
    clinic_data: ClinicSchema,
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    new_clinic_id = f"clinic_{uuid.uuid4().hex[:10]}"
    try:
        async with conn.cursor() as cursor:
            await cursor.execute(
                """
                INSERT INTO Clinics (clinic_id, name, address, phone_number, email, description, is_verified)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (new_clinic_id, clinic_data.name, clinic_data.address, clinic_data.phone_number,
                 clinic_data.email, clinic_data.description, clinic_data.is_verified)
            )
        await conn.commit()
        return {"message": "Tạo phòng khám thành công", "clinic_id": new_clinic_id, **clinic_data.dict()}
    except Exception as e:
        await conn.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL (đã rollback): {e}")

@router.get(
    "/clinics",
    summary="[READ] Lấy tất cả phòng khám",
    dependencies=admin_dependencies
)
async def get_all_clinics(
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    try:
        async with conn.cursor(aiomysql.DictCursor) as cursor:
            await cursor.execute("SELECT * FROM Clinics ORDER BY name")
            clinics = await cursor.fetchall()
        return clinics
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {e}")

@router.get(
    "/clinics/{clinic_id}",
    summary="[READ] Lấy chi tiết 1 phòng khám",
    dependencies=admin_dependencies
)
async def get_clinic_by_id(
    clinic_id: str,
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    try:
        async with conn.cursor(aiomysql.DictCursor) as cursor:
            await cursor.execute("SELECT * FROM Clinics WHERE clinic_id = %s", (clinic_id,))
            clinic = await cursor.fetchone()
            if not clinic:
                raise HTTPException(status_code=404, detail="Không tìm thấy phòng khám")
        return clinic
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {e}")

@router.put(
    "/clinics/{clinic_id}",
    summary="[UPDATE] Cập nhật một phòng khám",
    dependencies=admin_dependencies
)
async def update_clinic(
    clinic_id: str,
    clinic_data: ClinicSchema,
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    try:
        async with conn.cursor() as cursor:
            rows_affected = await cursor.execute(
                """
                UPDATE Clinics SET 
                    name = %s, address = %s, phone_number = %s, email = %s, 
                    description = %s, is_verified = %s
                WHERE clinic_id = %s
                """,
                (clinic_data.name, clinic_data.address, clinic_data.phone_number,
                 clinic_data.email, clinic_data.description, clinic_data.is_verified, clinic_id)
            )
        if rows_affected == 0:
            raise HTTPException(status_code=404, detail="Không tìm thấy phòng khám")
        await conn.commit()
        return {"message": "Cập nhật phòng khám thành công", "clinic_id": clinic_id}
    except Exception as e:
        await conn.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL (đã rollback): {e}")

@router.delete(
    "/clinics/{clinic_id}",
    summary="[DELETE] Xóa một phòng khám",
    dependencies=admin_dependencies
)
async def delete_clinic(
    clinic_id: str,
    conn: aiomysql.Connection = Depends(get_db_connection)
):
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

# === 8. APPOINTMENT MANAGEMENT (Quản lý Lịch hẹn) ===

@router.get(
    "/appointments",
    summary="[READ] Lấy tất cả lịch hẹn",
    dependencies=admin_dependencies
)
async def get_all_appointments(
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    try:
        async with conn.cursor(aiomysql.DictCursor) as cursor:
            await cursor.execute(
                """
                SELECT a.*, 
                       c.first_name AS cust_first, c.last_name AS cust_last,
                       d.first_name AS dent_first, d.last_name AS dent_last
                FROM Appointments a
                LEFT JOIN Users c ON a.customer_id = c.user_id
                LEFT JOIN Users d ON a.dentist_id = d.user_id
                ORDER BY a.appointment_datetime DESC
                """
            )
            appointments = await cursor.fetchall()
        return appointments
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {e}")

@router.put(
    "/appointments/{appointment_id}",
    summary="[UPDATE] Cập nhật trạng thái lịch hẹn (VD: Hủy)",
    dependencies=admin_dependencies
)
async def update_appointment_status(
    appointment_id: str,
    status_data: AppointmentStatusSchema,
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    try:
        async with conn.cursor() as cursor:
            rows_affected = await cursor.execute(
                "UPDATE Appointments SET status = %s WHERE appointment_id = %s",
                (status_data.status, appointment_id)
            )
        if rows_affected == 0:
            raise HTTPException(status_code=404, detail="Không tìm thấy lịch hẹn")
        await conn.commit()
        return {"message": f"Cập nhật trạng thái lịch hẹn thành '{status_data.status}'", "appointment_id": appointment_id}
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

# === 9. REPORT & REVIEW MANAGEMENT (Quản lý Đánh giá & Báo cáo) ===

@router.get(
    "/reviews",
    summary="[READ] Lấy tất cả đánh giá (reviews) để kiểm duyệt",
    dependencies=admin_dependencies
)
async def get_all_reviews(
    conn: aiomysql.Connection = Depends(get_db_connection)
):
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

@router.put(
    "/reviews/{review_id}",
    summary="[UPDATE] Xác thực/Ẩn một đánh giá (review)",
    dependencies=admin_dependencies
)
async def verify_review(
    review_id: str,
    review_data: ReviewVerifySchema,
    conn: aiomysql.Connection = Depends(get_db_connection)
):
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

@router.delete(
    "/reviews/{review_id}",
    summary="[DELETE] Xóa một đánh giá (review) (VD: spam)",
    dependencies=admin_dependencies
)
async def delete_review(
    review_id: str,
    conn: aiomysql.Connection = Depends(get_db_connection)
):
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

@router.get(
    "/reports/customer",
    summary="[READ] Lấy báo cáo vi phạm (reports) từ khách hàng",
    dependencies=admin_dependencies
)
async def get_customer_reports(
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    # (API Giả lập vì CSDL chưa có bảng 'Reports')
    mock_reports = [
        {"report_id": "rep1", "reporter_id": "cust1", "reported_user_id": "dent2", "reason": "Nha sĩ đến trễ 30 phút", "status": "Pending", "created_at": "2025-11-10T10:00:00"},
        {"report_id": "rep2", "reporter_id": "cust2", "reported_clinic_id": "clinic1", "reason": "Phòng khám thu thêm phí không báo trước", "status": "Pending", "created_at": "2025-11-09T14:00:00"}
    ]
    return mock_reports
    
# === 10. VERIFICATION APPROVAL ===

@router.post(
    "/approve/dentist/{user_id}",
    summary="Xác thực (approve) một nha sĩ",
    dependencies=admin_dependencies
)
async def approve_dentist(
    user_id: str,
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    try:
        async with conn.cursor() as cursor:
            rows_affected = await cursor.execute(
                "UPDATE Dentists SET is_verified = TRUE WHERE user_id = %s",
                (user_id,)
            )
        if rows_affected == 0:
            raise HTTPException(status_code=404, detail=f"Không tìm thấy Nha sĩ với ID: {user_id}")
        await conn.commit()
        return {"message": "Xác thực nha sĩ thành công", "user_id": user_id}
    except Exception as e:
        await conn.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi CSDL: {e}")

@router.post(
    "/approve/clinic/{clinic_id}",
    summary="Xác thực (approve) một phòng khám",
    dependencies=admin_dependencies
)
async def approve_clinic(
    clinic_id: str,
    conn: aiomysql.Connection = Depends(get_db_connection)
):
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