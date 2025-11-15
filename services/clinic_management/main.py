# File: /services/auth_service/main.py
import uvicorn
from fastapi import FastAPI
from . import routes 

app = FastAPI()

app.include_router(routes.router)

@app.get("/")
def read_root():
    return {"service": "clinic_manage (Python-Only)"}

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8005)