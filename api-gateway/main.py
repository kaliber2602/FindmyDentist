import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, HTMLResponse, Response as FastAPIResponse
from fastapi.middleware.cors import CORSMiddleware
import httpx
import logging
import os 
from fastapi.templating import Jinja2Templates 

# --- Cấu hình (Mới) ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))

# ===== (QUAN TRỌNG) TẮT SWAGGER TỰ ĐỘNG =====
app = FastAPI(
    title="FindMyDentist API Gateway",
    docs_url=None,  # Tắt /docs mặc định
    redoc_url=None  # Tắt /redoc mặc định
)
# =================================================

# --- CORS: cho phép các origin cụ thể để credentials hoạt động ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost", "http://127.0.0.1", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Ánh xạ Service (Giữ nguyên) ---
SERVICE_URLS = {
    "auth": "http://localhost:8001",
    "search": "http://localhost:8002",
    "profile": "http://localhost:8003",
    "notification": "http://localhost:8004",
}
client = httpx.AsyncClient()

# ===== (MỚI) ENDPOINT HIỂN THỊ SWAGGER TỔNG =====
# Chúng ta chiếm lại đường dẫn /docs bằng trang tùy chỉnh
@app.get("/docs", response_class=HTMLResponse)
async def get_unified_swagger_ui(request: Request):
    """
    Hiển thị trang HTML Swagger UI tùy chỉnh (có dropdown).
    """
    # Đảm bảo bạn đã tạo file /api-gateway/templates/swagger_ui.html
    return templates.TemplateResponse("swagger_ui.html", {
        "request": request,
        "service_urls": [
            {"name": "Auth Service", "url": "/docs-specs/auth.json"},
            {"name": "Search Service", "url": "/docs-specs/search.json"},
            {"name": "Profile Service", "url": "/docs-specs/profile.json"},
            {"name": "Notification Service", "url": "/docs-specs/notification.json"},
        ]
    })

# ===== (MỚI) CÁC ENDPOINT FETCHER (LẤY TÀI LIỆU) =====
@app.get("/docs-specs/auth.json")
async def get_auth_openapi():
    """Lấy schema OpenAPI từ Auth service (Port 8001)"""
    try:
        response = await client.get(f"{SERVICE_URLS['auth']}/openapi.json")
        return JSONResponse(content=response.json(), status_code=response.status_code)
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.get("/docs-specs/search.json")
async def get_search_openapi():
    """Lấy schema OpenAPI từ Search service (Port 8002)"""
    try:
        response = await client.get(f"{SERVICE_URLS['search']}/openapi.json")
        return JSONResponse(content=response.json(), status_code=response.status_code)
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)


@app.get("/docs-specs/profile.json")
async def get_profile_openapi():
    """Lấy schema OpenAPI từ Profile service (Port 8003)"""
    try:
        response = await client.get(f"{SERVICE_URLS['profile']}/openapi.json")
        return JSONResponse(content=response.json(), status_code=response.status_code)
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)


@app.get("/docs-specs/notification.json")
async def get_notification_openapi():
    """Lấy schema OpenAPI từ Notification service (Port 8004)"""
    try:
        response = await client.get(f"{SERVICE_URLS['notification']}/openapi.json")
        return JSONResponse(content=response.json(), status_code=response.status_code)
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)


# ===== HÀM PROXY VÀ ĐỊNH TUYẾN (Giữ nguyên) =====
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


@app.api_route("/api/profile/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_profile(request: Request, path: str):
    target_url = f"{SERVICE_URLS['profile']}/{path}"
    return await _proxy(request, target_url)


@app.api_route("/api/notify/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_notification(request: Request, path: str):
    target_url = f"{SERVICE_URLS['notification']}/{path}"
    return await _proxy(request, target_url)

@app.get("/")
def read_root():
    return {"message": "API Gateway (FastAPI) đang chạy"}

if __name__ == "__main__":
    logger.info("Khởi động API Gateway trên port 8000")
    uvicorn.run(app, host="127.0.0.1", port=8000) # Đổi sang 127.0.0.1 cho dễ click