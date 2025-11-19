import uvicorn
from fastapi import FastAPI
from services.profile_service import routes

app = FastAPI()

app.include_router(routes.router)

@app.get("/")
def read_root():
    return {"service": "Profile Service (Python-Only)"}

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8004)
