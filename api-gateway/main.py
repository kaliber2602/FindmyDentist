# File: /api-gateway/main.py
import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, HTMLResponse, Response as FastAPIResponse
from fastapi.middleware.cors import CORSMiddleware
import httpx
import logging
import os 
from fastapi.templating import Jinja2Templates 

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))

app = FastAPI(
    title="FindMyDentist API Gateway",
    docs_url=None,  
    redoc_url=None 
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost", "http://127.0.0.1", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SERVICE_URLS = {
    "auth": "http://localhost:8001",
    "search": "http://localhost:8002",
    "admin": "http://localhost:8003",
    "profile": "http://localhost:8004",
    "notification": "http://localhost:8005",
    "appointment": "http://localhost:8006",
    "clinic_management": "http://localhost:8007",
    "dentist_management": "http://localhost:8008",
}
client = httpx.AsyncClient()

@app.get("/docs", response_class=HTMLResponse)
async def get_unified_swagger_ui(request: Request):
    """
    Hiển thị trang HTML Swagger UI tùy chỉnh (có dropdown).
    """
    return templates.TemplateResponse("swagger_ui.html", {
        "request": request,
        "service_urls": [
            {"name": "Auth Service", "url": "/docs-specs/auth.json"},
            {"name": "Search Service", "url": "/docs-specs/search.json"},
            {"name": "Admin Service", "url": "/docs-specs/admin.json"}, # <-- Đã thêm
            {"name": "Profile Service", "url": "/docs-specs/profile.json"},
            {"name": "Notification Service", "url": "/docs-specs/notification.json"},
            {"name": "Appointment Service", "url": "/docs-specs/appointment.json"},
            {"name": "Clinic Management Service", "url": "/docs-specs/clinic_management.json"},
            {"name": "Dentist Management Service", "url": "/docs-specs/dentist_management.json"},

        ]
    })

@app.get("/docs-specs/auth.json")
async def get_auth_openapi():
    try:
        response = await client.get(f"{SERVICE_URLS['auth']}/openapi.json")
        return JSONResponse(content=response.json(), status_code=response.status_code)
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.get("/docs-specs/search.json")
async def get_search_openapi():
    try:
        response = await client.get(f"{SERVICE_URLS['search']}/openapi.json")
        return JSONResponse(content=response.json(), status_code=response.status_code)
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

# (MỚI) Thêm fetcher cho Admin Service
@app.get("/docs-specs/admin.json")
async def get_admin_openapi():
    """Lấy schema OpenAPI từ Admin service (Port 8003)"""
    try:
        response = await client.get(f"{SERVICE_URLS['admin']}/openapi.json")
        return JSONResponse(content=response.json(), status_code=response.status_code)
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)
    
@app.get("/docs-specs/profile.json")
async def get_profile_openapi():
    """Lấy schema OpenAPI từ Profile service (Port 8004)"""
    try:
        response = await client.get(f"{SERVICE_URLS['profile']}/openapi.json")
        return JSONResponse(content=response.json(), status_code=response.status_code)
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)


@app.get("/docs-specs/notification.json")
async def get_notification_openapi():
    """Lấy schema OpenAPI từ Notification service (Port 8005)"""
    try:
        response = await client.get(f"{SERVICE_URLS['notification']}/openapi.json")
        return JSONResponse(content=response.json(), status_code=response.status_code)
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)
    
@app.get("/docs-specs/appointment.json")
async def get_appointment_openapi():
    """Lấy schema OpenAPI từ Appointment service (Port 8003)"""
    try:
        response = await client.get(f"{SERVICE_URLS['appointment']}/openapi.json")
        return JSONResponse(content=response.json(), status_code=response.status_code)
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)
    


# ===== HÀM PROXY VÀ ĐỊNH TUYẾN =====
async def _proxy(request: Request, target_url: str):
    method = request.method
    body = await request.body()
    headers = dict(request.headers)
    headers.pop("host", None)

    try:
        r = await client.request(
            method=method,
            url=target_url,
            headers=headers,
            content=body,
            timeout=10.0
        )
        # Forward raw content and headers from upstream so cookies (Set-Cookie)
        # and other headers are preserved for the browser.
        resp_headers = dict(r.headers)
        # Remove hop-by-hop headers that should not be forwarded
        for h in ["transfer-encoding", "content-encoding", "content-length", "connection"]:
            resp_headers.pop(h, None)

        media_type = r.headers.get("content-type")
        return FastAPIResponse(content=r.content, status_code=r.status_code, headers=resp_headers, media_type=media_type)
    except httpx.ConnectError as e:
        return JSONResponse(content={"error": "Microservice không khả dụng"}, status_code=503)
    except Exception as e:
        return JSONResponse(content={"error": "Lỗi API Gateway"}, status_code=500)

@app.api_route("/api/auth/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_auth(request: Request, path: str):
    target_url = f"{SERVICE_URLS['auth']}/{path}"
    return await _proxy(request, target_url)

@app.api_route("/api/search/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_search(request: Request, path: str):
    target_url = f"{SERVICE_URLS['search']}/{path}"
    return await _proxy(request, target_url)

@app.api_route("/api/admin/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_admin(request: Request, path: str):
    target_url = f"{SERVICE_URLS['admin']}/{path}"
    return await _proxy(request, target_url)

@app.api_route("/api/profile/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_profile(request: Request, path: str):
    target_url = f"{SERVICE_URLS['profile']}/{path}"
    return await _proxy(request, target_url)


@app.api_route("/api/notify/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_notification(request: Request, path: str):
    target_url = f"{SERVICE_URLS['notification']}/{path}"
    return await _proxy(request, target_url)


@app.api_route("/api/appointment/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_appointment(request: Request, path: str):
    target_url = f"{SERVICE_URLS['appointment']}/{path}"
    return await _proxy(request, target_url)

@app.api_route("/api/dentist_management/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_dentist_management(request: Request, path: str):
    target_url = f"{SERVICE_URLS['dentist_management']}/{path}"
    return await _proxy(request, target_url)


@app.get("/")
def read_root():
    return {"message": "API Gateway (FastAPI) đang chạy"}

if __name__ == "__main__":
    logger.info("Khởi động API Gateway trên port 8000")
    uvicorn.run(app, host="127.0.0.1", port=8000)