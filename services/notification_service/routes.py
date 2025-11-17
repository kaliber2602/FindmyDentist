from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from pydantic_settings import BaseSettings
import os
import smtplib
from email.message import EmailMessage
from typing import Optional
import aiomysql
from .._shared.db import get_db_connection
import datetime

router = APIRouter()


class Settings(BaseSettings):
    smtp_host: str
    smtp_port: int = 587
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    from_email: str = "no-reply@findmydentist.local"

    # Use model_config to set env_file and ignore extra vars from .env
    model_config = {
        "extra": "ignore",
        "env_file": os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env')
    }


settings = Settings()


class EmailPayload(BaseModel):
    to: EmailStr
    subject: str
    body: str


def send_email_sync(to: str, subject: str, body: str):
    msg = EmailMessage()
    msg['Subject'] = subject
    msg['From'] = settings.from_email
    msg['To'] = to
    msg.set_content(body)

    try:
        if settings.smtp_user and settings.smtp_password:
            server = smtplib.SMTP(settings.smtp_host, settings.smtp_port)
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
            server.quit()
        else:
            # Try to send without auth
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
                server.send_message(msg)
    except Exception as e:
        raise


@router.post("/send")
def send_email(payload: EmailPayload):
    """Simple endpoint to send an email."""
    try:
        send_email_sync(payload.to, payload.subject, payload.body)
        return {"message": "Email sent"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/send-appointment-reminders")
async def send_appointment_reminders(days: int = 1, conn: aiomysql.Connection = Depends(get_db_connection)):
    """Send reminder emails for appointments happening within `days` days from now.
       This endpoint will query DB for appointments with status Pending or Confirmed.
    """
    try:
        now = datetime.datetime.utcnow()
        end = now + datetime.timedelta(days=days)
        async with conn.cursor(aiomysql.DictCursor) as cursor:
            await cursor.execute(
                """
                SELECT a.appointment_id, a.appointment_datetime, a.status, u.email, u.first_name, c.name as clinic_name
                FROM Appointments a
                JOIN Users u ON a.customer_id = u.user_id
                LEFT JOIN Clinics c ON a.clinic_id = c.clinic_id
                WHERE a.appointment_datetime BETWEEN %s AND %s
                  AND a.status IN ('Pending','Confirmed')
                """,
                (now, end)
            )
            rows = await cursor.fetchall()

            sent = []
            for r in rows:
                to = r['email']
                when = r['appointment_datetime']
                clinic = r.get('clinic_name') or ''
                subject = f"Nhắc lịch hẹn tại {clinic} - {when}"
                body = f"Xin chào {r.get('first_name','')},\n\nBạn có lịch hẹn vào {when} tại {clinic}. Vui lòng đến đúng giờ hoặc liên hệ để thay đổi.\n\nTrân trọng,\nFindMyDentist"
                try:
                    send_email_sync(to, subject, body)
                    sent.append(r['appointment_id'])
                except Exception:
                    # continue on errors
                    continue

        return {"sent": sent}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
