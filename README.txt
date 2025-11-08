pip install -r requirements.txt

python -m services.auth_service.main 
python -m services.search_service.main
python  api-gateway/main.py