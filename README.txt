./start_all.bat

pip install -r requirements.txt

python -m services.auth_service.main 
python -m services.search_service.main
python -m services.admin_service.main
python -m services.profile_service.main
python -m services.notification_service.main
python -m services.appointment_service.main
python -m services.clinic_management.main
python -m services.dentist_management.main

python  api-gateway/main.py