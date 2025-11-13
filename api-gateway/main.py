# File: /api-gateway/main.py
import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, HTMLResponse 
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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SERVICE_URLS = {
    "auth": "http://localhost:8001",
    "search": "http://localhost:8002",
    "admin": "http://localhost:8003"
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
            {"name": "Admin Service", "url": "/docs-specs/admin.json"} # <-- Đã thêm
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
        return JSONResponse(content=r.json(), status_code=r.status_code)
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

@app.get("/")
def read_root():
    return {"message": "API Gateway (FastAPI) đang chạy"}

if __name__ == "__main__":
    logger.info("Khởi động API Gateway trên port 8000")
    uvicorn.run(app, host="127.0.0.1", port=8000)