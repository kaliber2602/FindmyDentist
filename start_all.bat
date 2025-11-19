@echo off
TITLE FindMyDentist Services

echo --- Installing requirements ---
call pip install -r requirements.txt

echo --- Starting all microservices in new windows ---
start "Auth Service (Port 8001)" python -m services.auth_service.main
start "Search Service (Port 8002)" python -m services.search_service.main
start "Admin Service (Port 8003)" python -m services.admin_service.main
start "Profile Service (Port 8004)" python -m services.profile_service.main
start "Notification Service (Port 8005)" python -m services.notification_service.main
start "Appointment Service (Port 8006)" python -m services.appointment_service.main
start "Clinic management Service (Port 8007)" python -m services.clinic_management.main
start "Dentist management Service (Port 8008)" python -m services.dentist_management.main


echo --- Starting API Gateway (Port 8000) in this window ---
python api-gateway/main.py