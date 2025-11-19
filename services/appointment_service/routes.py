
from fastapi import APIRouter, Depends, Response, Request, HTTPException
from .._shared.db import get_db_connection
from .._shared.security import get_current_user, TokenPayload  # ✅ Import từ Auth system
import aiomysql
router = APIRouter()

@router.get("/appointments")
async def get_all_appointments(
    response: Response, conn: aiomysql.Connection = Depends(get_db_connection)
):
    """
    API này trả về danh sách appointment để hiển thị như Dentist card.
    Mỗi bản ghi tương ứng với một bác sĩ hoặc phòng khám được đặt lịch gần đây.
    """
    try:
        async with conn.cursor(aiomysql.cursors.DictCursor) as cursor:
            await cursor.execute("""
                SELECT 
                    CONCAT(u.first_name, ' ', u.last_name) AS name,
                    d.specialization AS specialty,
                    c.name AS clinic,
                    c.clinic_id AS clinic_id,
                    d.user_id AS dentist_id,
                    c.address AS address,
                    c.average_rating AS rating,
                    COALESCE(s.name, 'General Dentistry') AS service,
                    'dentist' AS type,
                    -- lấy hình đầu tiên trong mảng JSON nếu có
                    COALESCE(JSON_UNQUOTE(JSON_EXTRACT(c.images, '$[0]')), '/assets/imgs/default-dentist.jpg') AS image
                FROM appointments a
                JOIN dentists d ON a.dentist_id = d.user_id
                JOIN users u ON u.user_id = d.user_id
                JOIN clinics c ON a.clinic_id = c.clinic_id
                LEFT JOIN appointment_services aps ON a.appointment_id = aps.appointment_id
                LEFT JOIN services s ON aps.service_id = s.service_id
                ORDER BY a.appointment_datetime DESC
            """)
            rows = await cursor.fetchall()

            # thêm city tách từ address nếu có dấu phẩy cuối
            for r in rows:
                if r.get("address"):
                    parts = r["address"].split(",")
                    r["city"] = parts[-1].strip() if len(parts) > 1 else "Unknown"
                else:
                    r["city"] = "Unknown"

            return rows

    except Exception as e:
        print("❌ Lỗi MySQL:", e)
        response.status_code = 500
        return {"error": "Lỗi truy vấn CSDL", "details": str(e)}


@router.get("/appointments/{appointment_id}")
async def get_appointment_details(appointment_id: int, response: Response, conn: aiomysql.Connection = Depends(get_db_connection)):
    """
    API này lấy chi tiết một cuộc hẹn dựa trên appointment_id
    """
    try:
        async with conn.cursor(aiomysql.cursors.DictCursor) as cursor:
            # Truy vấn CSDL để lấy chi tiết cuộc hẹn
            await cursor.execute(
                """
                SELECT 
                    a.appointment_id, a.appointment_datetime, a.status,
                    u.first_name AS patient_first_name, u.last_name AS patient_last_name,
                    d.first_name AS dentist_first_name, d.last_name AS dentist_last_name
                FROM appointments a
                JOIN users u ON a.customer_id = u.user_id
                JOIN dentists d ON a.dentist_id = d.user_id
                WHERE a.appointment_id = %s
                """,
                (appointment_id,)
            )
            appointment = await cursor.fetchone()
            
            if not appointment:
                response.status_code = 404
                return {"error": "Không tìm thấy cuộc hẹn"}
                
            return appointment
            
    except Exception as e:
        response.status_code = 500
        return {"error": "Lỗi truy vấn CSDL", "details": str(e)}
    
    
    
    
@router.post("/appointments")
async def create_appointment(request: Request, response: Response, conn: aiomysql.Connection = Depends(get_db_connection)):
    try:
        data = await request.json()
        print("📥 Dữ liệu nhận được:", data)

        customer_id = data.get("customer_id")
        dentist_id = data.get("dentist_id")
        clinic_id = data.get("clinic_id")
        appointment_date = data.get("appointmentDate")
        appointment_time = data.get("appointmentTime")
        notes = data.get("notes", "")

        if not (customer_id and dentist_id and clinic_id and appointment_date and appointment_time):
            raise HTTPException(status_code=400, detail="Thiếu thông tin cuộc hẹn")

        appointment_datetime = f"{appointment_date} {appointment_time}:00"

        async with conn.cursor() as cursor:
            # ✅ Sinh ID thủ công: MAX(appointment_id) + 1
            await cursor.execute("SELECT MAX(appointment_id) FROM appointments")
            result = await cursor.fetchone()
            new_id = int(result[0]) + 1 if result and result[0] else 1
            print(f"🆔 New appointment_id = {new_id}")

            await cursor.execute("""
                INSERT INTO appointments (
                    appointment_id, customer_id, dentist_id, clinic_id,
                    appointment_datetime, status, notes, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
            """, (new_id, customer_id, dentist_id, clinic_id, appointment_datetime, "pending", notes))

            await conn.commit()

        print(f"✅ Appointment created successfully with ID={new_id}")
        return {
            "message": "✅ Appointment created successfully!",
            "appointment_id": new_id
        }

    except Exception as e:
        print("❌ Lỗi khi lưu appointment:", e)
        response.status_code = 500
        return {"error": "Database error", "details": str(e)}

    
    
    
    
@router.delete("/appointments/{appointment_id}")
async def cancel_appointment(appointment_id: int, response: Response, conn: aiomysql.Connection = Depends(get_db_connection)):
    """
    API này hủy một cuộc hẹn dựa trên appointment_id
    """
    try:
        async with conn.cursor() as cursor:
            # Cập nhật trạng thái cuộc hẹn thành 'canceled'
            await cursor.execute(
                "UPDATE appointments SET status = 'canceled' WHERE appointment_id = %s",
                (appointment_id,)
            )
            await conn.commit()
            
            if cursor.rowcount == 0:
                response.status_code = 404
                return {"error": "Không tìm thấy cuộc hẹn để hủy"}
                
            return {"message": "Cuộc hẹn đã được hủy thành công"}
            
    except Exception as e:
        response.status_code = 500
        return {"error": "Lỗi khi hủy cuộc hẹn", "details": str(e)}
    
    
@router.patch("/appointments/{appointment_id}")
async def reschedule_appointment(appointment_id: int, new_datetime: str, response: Response, conn: aiomysql.Connection = Depends(get_db_connection)):
    """
    API này thay đổi thời gian cuộc hẹn dựa trên appointment_id
    """
    try:
        async with conn.cursor() as cursor:
            # Cập nhật thời gian cuộc hẹn mới
            await cursor.execute(
                "UPDATE appointments SET appointment_datetime = %s WHERE appointment_id = %s",
                (new_datetime, appointment_id)
            )
            await conn.commit()
            
            if cursor.rowcount == 0:
                response.status_code = 404
                return {"error": "Không tìm thấy cuộc hẹn để thay đổi"}
                
            return {"message": "Cuộc hẹn đã được thay đổi thành công"}
            
    except Exception as e:
        response.status_code = 500
        return {"error": "Lỗi khi thay đổi cuộc hẹn", "details": str(e)}
    

@router.get("/appointments/dentist/{dentist_id}")
async def get_appointments_by_dentist(dentist_id: int, response: Response, conn: aiomysql.Connection = Depends(get_db_connection)):
    """
    Lấy tất cả cuộc hẹn của một nha sĩ dựa trên dentist_id
    """
    try:
        async with conn.cursor(aiomysql.cursors.DictCursor) as cursor:
            await cursor.execute(
                """
                SELECT 
                    a.appointment_id, a.appointment_datetime, a.status,
                    u.first_name AS patient_first_name, 
                    u.last_name AS patient_last_name
                FROM appointments a
                JOIN users u ON a.customer_id = u.user_id
                WHERE a.dentist_id = %s
                ORDER BY a.appointment_datetime DESC
                """,
                (dentist_id,)
            )
            appointments = await cursor.fetchall()
            return appointments
            
    except Exception as e:
        response.status_code = 500
        return {"error": "Lỗi truy vấn CSDL", "details": str(e)}
    
    
    
@router.patch("/appointments/{appointment_id}/confirm")
async def confirm_appointment(
    appointment_id: int,
    response: Response,
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    """
    API xác nhận một cuộc hẹn (status = 'confirmed')
    """
    try:
        async with conn.cursor() as cursor:
            await cursor.execute(
                "UPDATE appointments SET status = 'confirmed' WHERE appointment_id = %s",
                (appointment_id,)
            )
            await conn.commit()

            if cursor.rowcount == 0:
                response.status_code = 404
                return {"error": "Không tìm thấy cuộc hẹn để xác nhận"}

        return {"message": f"Cuộc hẹn {appointment_id} đã được xác nhận thành công"}
    
    except Exception as e:
        response.status_code = 500
        return {"error": "Lỗi khi xác nhận cuộc hẹn", "details": str(e)}
    
    
    
@router.patch("/appointments/{appointment_id}/cancel")
async def cancel_appointment(
    appointment_id: int,
    response: Response,
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    """
    API này hủy một cuộc hẹn dựa trên appointment_id
    """
    try:
        async with conn.cursor() as cursor:
            # Cập nhật trạng thái thành 'cancelled'
            await cursor.execute(
                "UPDATE appointments SET status = 'cancelled' WHERE appointment_id = %s",
                (appointment_id,)
            )
            await conn.commit()

            if cursor.rowcount == 0:
                response.status_code = 404
                return {"error": "Không tìm thấy cuộc hẹn để hủy"}

        return {"message": f"Cuộc hẹn {appointment_id} đã được hủy thành công"}
    except Exception as e:
        response.status_code = 500
        return {"error": "Lỗi khi hủy cuộc hẹn", "details": str(e)}
    
    
    
    
    
@router.get("/appointments/schedule/{dentist_id}")
async def get_schedule(
    dentist_id: int,
    start: str,
    end: str,
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    """
    Lấy lịch hẹn theo khoảng ngày của 1 nha sĩ.
    """
    try:
        async with conn.cursor(aiomysql.cursors.DictCursor) as cursor:
            await cursor.execute("""
                SELECT 
                    a.appointment_id,
                    a.appointment_datetime,
                    a.status,
                    p.first_name AS patient_first_name,
                    p.last_name AS patient_last_name,
                    d.first_name AS dentist_first_name,
                    d.last_name AS dentist_last_name
                FROM appointments a
                JOIN users p ON a.customer_id = p.user_id
                JOIN users d ON a.dentist_id = d.user_id
                WHERE a.dentist_id = %s
                  AND DATE(a.appointment_datetime) BETWEEN %s AND %s
                ORDER BY a.appointment_datetime ASC
            """, (dentist_id, start, end))

            return await cursor.fetchall()

    except Exception as e:
        return {
            "error": "Lỗi khi lấy lịch biểu",
            "details": str(e)
        }