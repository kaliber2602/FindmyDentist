pip install -r requirements.txt

python -m services.auth_service.main 
python -m services.search_service.main
python -m services.appointment_service.main
python -m services.dentist_management.main
python -m services.customer_service.main
python  api-gateway/main.py