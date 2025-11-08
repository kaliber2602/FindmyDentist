# File: /services/search_service/main.py
import uvicorn
from fastapi import FastAPI
from . import routes # Import file routes.py

app = FastAPI()

# Bao gồm các router từ file routes.py
app.include_router(routes.router)

@app.get("/")
def read_root():
    return {"service": "Search Service (Python-Only)"}

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8002)