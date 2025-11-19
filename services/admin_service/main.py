# File: /services/admin_service/main.py
import uvicorn
from fastapi import FastAPI
from . import routes 

app = FastAPI(
    title="Admin Service",
    description="Dịch vụ này xử lý các tác vụ quản trị viên (xác thực, quản lý user...)"
)

# Bao gồm các router từ file routes.py
app.include_router(routes.router)

@app.get("/")
def read_root():
    return {"service": "Admin Service (Python-Only)"}

if __name__ == "__main__":
    # Chạy trên một cổng mới, ví dụ: 8003
    uvicorn.run(app, host="127.0.0.1", port=8003)