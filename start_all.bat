@echo off
TITLE FindMyDentist Services

echo --- Installing requirements ---
call pip install -r requirements.txt

echo --- Starting all microservices in new windows ---
start "Auth Service (Port 8001)" python -m services.auth_service.main
start "Search Service (Port 8002)" python -m services.search_service.main
start "Admin Service (Port 8003)" python -m services.admin_service.main

echo --- Starting API Gateway (Port 8000) in this window ---
python api-gateway/main.py