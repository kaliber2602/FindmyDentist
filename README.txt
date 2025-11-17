pip install -r requirements.txt

# Chạy các service (mỗi service 1 terminal)
python -m services.auth_service.main
python -m services.search_service.main
python -m services.profile_service.main
python -m services.notification_service.main
python  api-gateway/main.py


