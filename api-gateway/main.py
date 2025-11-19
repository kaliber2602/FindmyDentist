# File: /api-gateway/main.py
import uvicorn
from fastapi import FastAPI, Request, APIRouter
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

# --- Configuration ---
SERVICE_URLS = {
    "auth": "http://localhost:8001",
    "search": "http://localhost:8002",
    "admin": "http://localhost:8003"
}
client = httpx.AsyncClient()

# ===============================================
# HÀM PROXY CHUNG
# ===============================================
async def _proxy(request: Request, service_name: str, path: str):
    """
    Hàm proxy chung để chuyển tiếp request đến microservice đích.
    """
    target_url = f"{SERVICE_URLS[service_name]}/{path}"
    method = request.method
    body = await request.body()
    headers = dict(request.headers)
    headers.pop("host", None) # Xóa header host để tránh lỗi định tuyến

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
        return JSONResponse(content={"error": f"{service_name.capitalize()} Microservice không khả dụng (Port {SERVICE_URLS[service_name].split(':')[-1]})"}, status_code=503)
    except Exception as e:
        logger.error(f"Lỗi khi proxy request tới {service_name}: {e}")
        return JSONResponse(content={"error": f"Lỗi API Gateway: {e.__class__.__name__}"}, status_code=500)

# ===============================================
# LOGIC GỘP OPENAPI SPECS CHO MỤC ĐÍCH DOCUMENTATION
# ===============================================
async def get_merged_openapi():
    """Tải và gộp các OpenAPI specs từ tất cả microservices."""
    merged_spec = {
        "openapi": "3.1.0",
        "info": {
            "title": "FindMyDentist Unified API Gateway",
            "version": "1.0.0 (Merged)",
            "description": "API Gateway gộp các dịch vụ Auth, Search và Admin để cung cấp tài liệu chi tiết."
        },
        "paths": {},
        "components": {"schemas": {}},
        "tags": []
    }
    
    services_to_merge = [
        {"name": "Auth", "url": SERVICE_URLS['auth']},
        {"name": "Search", "url": SERVICE_URLS['search']},
        {"name": "Admin", "url": SERVICE_URLS['admin']}
    ]

    for service in services_to_merge:
        service_tag = service["name"]
        try:
            response = await client.get(f"{service['url']}/openapi.json")
            if response.status_code == 200:
                spec = response.json()
                
                # Gộp Paths, thêm tiền tố /api/<service_name>
                for path, operations in spec.get("paths", {}).items():
                    proxy_path_prefix = f"/api/{service_tag.lower()}"
                    clean_path = path.lstrip('/')
                    new_path = f"{proxy_path_prefix}/{clean_path}"
                    
                    # Gán tag và gộp operations
                    merged_spec["paths"][new_path] = operations
                    for method, operation in operations.items():
                        if isinstance(operation, dict):
                            # Đặt tag để nhóm trong Swagger UI
                            operation["tags"] = [service_tag] 
                        
                # Gộp Components (chỉ gộp schemas)
                for schema_name, schema_def in spec.get("components", {}).get("schemas", {}).items():
                    if schema_name not in merged_spec["components"]["schemas"]:
                        merged_spec["components"]["schemas"][schema_name] = schema_def
                
                # Thêm tags
                merged_spec["tags"].append({"name": service_tag, "description": f"Endpoints cho {service_tag} Service"})

        except Exception as e:
            logger.warning(f"Không thể tải OpenAPI cho {service_tag}. Hãy đảm bảo {service_tag} Service đang chạy.")

    return JSONResponse(content=merged_spec)

# ===============================================
# CẤU HÌNH FASTAPI APP VÀ APIRouter
# ===============================================

app = FastAPI(
    title="FindMyDentist API Gateway",
    docs_url=None,      # Vô hiệu hóa docs mặc định
    redoc_url=None,     # Vô hiệu hóa redoc mặc định
    openapi_url=None    # Vô hiệu hóa /openapi.json mặc định
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Định nghĩa Route OpenAPI tùy chỉnh (cho Docs chi tiết)
@app.get("/openapi.json", include_in_schema=False)
async def get_openapi_route():
    """Endpoint trả về OpenAPI spec đã gộp chi tiết từ các microservice."""
    return await get_merged_openapi()

# 2. Định nghĩa Route cho Swagger UI (sử dụng template)
@app.get("/docs", response_class=HTMLResponse, include_in_schema=False)
async def get_unified_swagger_ui(request: Request):
    """Hiển thị trang HTML Swagger UI tùy chỉnh, trỏ đến /openapi.json đã gộp."""
    return templates.TemplateResponse("swagger_ui.html", {
        "request": request,
        "spec_url": "/openapi.json" 
    })

# 3. Hàm tạo APIRouter Proxy
def create_proxy_router(service_name: str):
    router = APIRouter(
        prefix=f"/api/{service_name.lower()}",
        tags=[f"{service_name.capitalize()} Service"],
    )
    
    # Định nghĩa route proxy catch-all
    @router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"], summary=f"[PROXY] {service_name.capitalize()} Service")
    async def proxy_routes(request: Request, path: str):
        # Lớp logic proxy sẽ xử lý chuyển tiếp request
        return await _proxy(request, service_name.lower(), path)
    
    return router

# GẮN CÁC ROUTER VÀO ỨNG DỤNG CHÍNH
app.include_router(create_proxy_router("Auth"))
app.include_router(create_proxy_router("Search"))
app.include_router(create_proxy_router("Admin"))

# 4. Route gốc
@app.get("/")
def read_root():
    return {"message": "API Gateway (FastAPI) đang chạy"}

if __name__ == "__main__":
    logger.info("Khởi động API Gateway trên port 8000")
    uvicorn.run(app, host="127.0.0.1", port=8000)