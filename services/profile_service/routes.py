from fastapi import APIRouter, Depends, HTTPException, status
import logging
from services._shared.db import get_db_connection
from services._shared.security import get_current_user, TokenPayload
import aiomysql

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/me", summary="Get current user profile", description="Return profile data for the logged-in user")
async def get_my_profile(
    current_user: TokenPayload = Depends(get_current_user),
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    try:
        async with conn.cursor(aiomysql.DictCursor) as cursor:
            await cursor.execute(
                "SELECT user_id, email, first_name, last_name, phone_number, role FROM Users WHERE user_id = %s",
                (current_user.sub,)
            )
            user = await cursor.fetchone()

            if not user:
                raise HTTPException(status_code=404, detail="User not found")

            # Optionally fetch extra data for customers/dentists
            if user.get('role') == 'CUSTOMER':
                try:
                    await cursor.execute("SELECT is_verified FROM Customers WHERE user_id = %s", (user['user_id'],))
                    cust = await cursor.fetchone()
                    if cust:
                        # cust may be dict or tuple depending on cursor type
                        if isinstance(cust, dict):
                            user['is_verified'] = cust.get('is_verified', False)
                        else:
                            user['is_verified'] = cust[0] if len(cust) > 0 else False
                except Exception:
                    # Column may not exist in older schemas; default to False
                    logger.warning("Customers.is_verified column not found or query failed for user %s", user.get('user_id'))
                    user['is_verified'] = False
            elif user.get('role') == 'DENTIST':
                try:
                    await cursor.execute("SELECT is_verified, clinic_name FROM Dentists WHERE user_id = %s", (user['user_id'],))
                    dent = await cursor.fetchone()
                    if dent:
                        if isinstance(dent, dict):
                            user.update(dent)
                        else:
                            # tuple: (is_verified, clinic_name)
                            user['is_verified'] = dent[0] if len(dent) > 0 else False
                            user['clinic_name'] = dent[1] if len(dent) > 1 else None
                except Exception:
                    logger.warning("Dentists.is_verified/clinic_name query failed for user %s", user.get('user_id'))

        return {"profile": user}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error in get_my_profile")
        raise HTTPException(status_code=500, detail=f"DB error: {e}")


@router.get("/{user_id}", summary="Get profile by user id", description="Return public profile for given user id")
async def get_profile_by_id(user_id: str, conn: aiomysql.Connection = Depends(get_db_connection)):
    try:
        async with conn.cursor(aiomysql.DictCursor) as cursor:
            await cursor.execute(
                "SELECT user_id, email, first_name, last_name, phone_number, role FROM Users WHERE user_id = %s",
                (user_id,)
            )
            user = await cursor.fetchone()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
        return {"profile": user}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error in get_profile_by_id")
        raise HTTPException(status_code=500, detail=f"DB error: {e}")


@router.get("/me/appointments", summary="Get my appointments", description="List appointments for current logged-in customer")
async def get_my_appointments(
    current_user: TokenPayload = Depends(get_current_user),
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    try:
        async with conn.cursor(aiomysql.DictCursor) as cursor:
            await cursor.execute(
                """
                SELECT a.appointment_id, a.appointment_datetime, a.status, a.notes,
                       u.user_id AS dentist_id, u.first_name AS dentist_first, u.last_name AS dentist_last,
                       c.clinic_id, c.name AS clinic_name
                FROM Appointments a
                LEFT JOIN Users u ON a.dentist_id = u.user_id
                LEFT JOIN Clinics c ON a.clinic_id = c.clinic_id
                WHERE a.customer_id = %s
                ORDER BY a.appointment_datetime DESC
                """,
                (current_user.sub,)
            )
            rows = await cursor.fetchall()

            # Fetch services per appointment
            appt_ids = [r['appointment_id'] for r in rows]
            services_map = {}
            if appt_ids:
                fmt = ','.join(['%s'] * len(appt_ids))
                await cursor.execute(
                    f"SELECT asv.appointment_id, s.service_id, s.name FROM Appointment_Services asv JOIN Services s ON asv.service_id = s.service_id WHERE asv.appointment_id IN ({fmt})",
                    tuple(appt_ids)
                )
                svc_rows = await cursor.fetchall()
                for s in svc_rows:
                    services_map.setdefault(s['appointment_id'], []).append({'service_id': s['service_id'], 'name': s['name']})

            for r in rows:
                r['services'] = services_map.get(r['appointment_id'], [])

        return {"appointments": rows}
    except Exception as e:
        logger.exception("Error in get_my_appointments")
        raise HTTPException(status_code=500, detail=f"DB error: {e}")


@router.get("/me/history", summary="Get my medical history", description="Return completed appointments and reviews for the user")
async def get_my_history(
    current_user: TokenPayload = Depends(get_current_user),
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    try:
        async with conn.cursor(aiomysql.DictCursor) as cursor:
            await cursor.execute(
                """
                SELECT a.appointment_id, a.appointment_datetime, a.status, a.notes,
                       u.user_id AS dentist_id, u.first_name AS dentist_first, u.last_name AS dentist_last,
                       c.clinic_id, c.name AS clinic_name
                FROM Appointments a
                LEFT JOIN Users u ON a.dentist_id = u.user_id
                LEFT JOIN Clinics c ON a.clinic_id = c.clinic_id
                WHERE a.customer_id = %s AND a.status = 'Completed'
                ORDER BY a.appointment_datetime DESC
                """,
                (current_user.sub,)
            )
            rows = await cursor.fetchall()

            # Attach review if exists
            for r in rows:
                await cursor.execute("SELECT rating, comment FROM Reviews WHERE appointment_id = %s", (r['appointment_id'],))
                rev = await cursor.fetchone()
                r['review'] = rev

        return {"history": rows}
    except Exception as e:
        logger.exception("Error in get_my_history")
        raise HTTPException(status_code=500, detail=f"DB error: {e}")


@router.put("/me", summary="Update my profile", description="Update current user's profile fields")
async def update_my_profile(
    payload: dict,
    current_user: TokenPayload = Depends(get_current_user),
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    allowed = ['first_name', 'middle_name', 'last_name', 'phone_number', 'address', 'date_of_birth']
    updates = {k: payload[k] for k in payload.keys() if k in allowed}
    if not updates:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    set_clause = ', '.join([f"{k} = %s" for k in updates.keys()])
    params = tuple(updates.values()) + (current_user.sub,)
    try:
        async with conn.cursor() as cursor:
            await cursor.execute(f"UPDATE Users SET {set_clause} WHERE user_id = %s", params)
            # Fetch email to notify
            await cursor.execute("SELECT email FROM Users WHERE user_id = %s", (current_user.sub,))
            u = await cursor.fetchone()
            email_addr = u and u[0]
            # Notify user (best-effort)
            try:
                async with httpx.AsyncClient() as client:
                    if email_addr:
                        try:
                            # Send to notification service (port 8005)
                            await client.post("http://localhost:8005/send", json={
                                "to": email_addr,
                                "subject": "Thông báo: Thay đổi thông tin tài khoản",
                                "body": "Thông tin tài khoản của bạn đã được cập nhật thành công."
                            }, timeout=5.0)
                        except Exception as exc:
                            # Log but don't fail the profile update
                            import logging
                            logging.getLogger(__name__).exception("Failed to notify on profile update for %s", email_addr)
            except Exception:
                pass

            return {"message": "Profile updated"}
    except Exception as e:
        logger.exception("Error in update_my_profile")
        raise HTTPException(status_code=500, detail=f"DB error: {e}")


from services._shared.security import verify_password, get_password_hash
import httpx

@router.post("/me/change-password", summary="Change password", description="Change current user's password by providing old and new password")
async def change_my_password(
    body: dict,
    current_user: TokenPayload = Depends(get_current_user),
    conn: aiomysql.Connection = Depends(get_db_connection)
):
    old = body.get('old_password')
    new = body.get('new_password')
    if not old or not new:
        raise HTTPException(status_code=400, detail="Missing old or new password")

    try:
        async with conn.cursor(aiomysql.DictCursor) as cursor:
            await cursor.execute("SELECT password_hash FROM Users WHERE user_id = %s", (current_user.sub,))
            user = await cursor.fetchone()
            if not user or not verify_password(old, user['password_hash']):
                raise HTTPException(status_code=400, detail="Old password is incorrect")

            new_hash = get_password_hash(new)
            await cursor.execute("UPDATE Users SET password_hash = %s WHERE user_id = %s", (new_hash, current_user.sub))

            # Lấy email thực của user để gửi thông báo
            await cursor.execute("SELECT email FROM Users WHERE user_id = %s", (current_user.sub,))
            ue = await cursor.fetchone()
            email_addr = None
            if ue:
                # ue có thể là dict hoặc tuple
                if isinstance(ue, dict):
                    email_addr = ue.get('email')
                else:
                    email_addr = ue[0]

            # Gửi notification (best-effort) nếu có email
            try:
                if email_addr:
                    async with httpx.AsyncClient() as client:
                        try:
                            await client.post("http://localhost:8005/send", json={
                                "to": email_addr,
                                "subject": "Thông báo: Mật khẩu đã được thay đổi",
                                "body": "Mật khẩu tài khoản của bạn đã được thay đổi. Nếu không phải bạn, hãy liên hệ hỗ trợ."
                            }, timeout=5.0)
                        except Exception as exc:
                            import logging
                            logging.getLogger(__name__).exception("Failed to notify on password change for %s", email_addr)
            except Exception:
                pass

            return {"message": "Password updated"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error in change_my_password")
        raise HTTPException(status_code=500, detail=f"DB error: {e}")
    
