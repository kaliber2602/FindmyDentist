from fastapi import APIRouter, Depends, Response, Request, HTTPException
from .._shared.db import get_db_connection
from .._shared.security import get_current_user, TokenPayload  # ✅ Import từ Auth system
import aiomysql

router = APIRouter()

@router.get("/customers/{user_id}")
async def get_customer_by_id(user_id: int, db: aiomysql.Connection = Depends(get_db_connection)):
    """
    Lấy thông tin khách hàng theo user_id (chỉ cho phép chính chủ hoặc admin).
    """
    try:
        # Chỉ cho phép chính chủ hoặc admin x
        async with db.cursor(aiomysql.DictCursor) as cursor:
            await cursor.execute("""
                SELECT 
                    u.user_id,
                    u.first_name as first_name,
                    u.middle_name as middle_name,
                    u.last_name as last_name,
                    u.email as email,
                    u.date_of_birth as date_of_birth,
                    u.phone_number as phone_number,
                    u.address as address,
                    c.cccd_num as cccd_num
                FROM users u
                JOIN customers c ON u.user_id = c.user_id
                WHERE u.user_id = %s
            """, (user_id,))
            customer = await cursor.fetchone()

        if not customer:
            raise HTTPException(status_code=404, detail="Không tìm thấy khách hàng")

        return customer

    except Exception as e:
        print("❌ Lỗi MySQL:", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/customers/me")
async def get_my_customer_profile(
    current_user: TokenPayload = Depends(get_current_user),
    db: aiomysql.Connection = Depends(get_db_connection)
):
    try:
        async with db.cursor(aiomysql.DictCursor) as cursor:
            await cursor.execute("""
                SELECT 
                    u.user_id as user_id,
                    u.first_name as first_name,
                    u.middle_name as middle_name,
                    u.last_name as last_name,
                    u.email as email,
                    u.date_of_birth as date_of_birth,
                    u.phone_number as phone_number,
                    c.address as address, 
                    c.cccd_num as cccd_num
                FROM users u
                JOIN customers c ON u.user_id = c.user_id
                WHERE u.user_id = %s
            """, (current_user.user_id,))
            customer = await cursor.fetchone()

        if not customer:
            raise HTTPException(status_code=404, detail="Không tìm thấy hồ sơ người dùng")

        return customer

    except Exception as e:
        print("❌ Lỗi MySQL:", e)
        raise HTTPException(status_code=500, detail=str(e))
    
    
    
@router.put("/customers")
async def update_customer_profile(
    updated_data: dict,
    current_user: TokenPayload = Depends(get_current_user),
    db: aiomysql.Connection = Depends(get_db_connection)
):
    """
    Cập nhật thông tin hồ sơ khách hàng của chính chủ.
    """
    try:
        async with db.cursor() as cursor:
            # Cập nhật bảng users
            await cursor.execute("""
                UPDATE users
                SET first_name = %s,
                    middle_name = %s,
                    last_name = %s,
                    phone_number = %s,
                    cccd_num = %s,
                    address = %s
                WHERE user_id = %s
            """, (
                updated_data.get("first_name"),
                updated_data.get("middle_name"),
                updated_data.get("last_name"),
                updated_data.get("phone_number"),
                updated_data.get("ccccd_num"),
                updated_data.get("address"),
                current_user.user_id
            ))
            await db.commit()

        return {"message": "Cập nhật hồ sơ khách hàng thành công"}

    except Exception as e:
        print("❌ Lỗi MySQL:", e)
        raise HTTPException(status_code=500, detail=str(e))