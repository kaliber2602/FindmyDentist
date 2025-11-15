
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from . import routes 

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500"],  # domain của frontend
    allow_credentials=True,  # cho phép gửi cookie JWT
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(routes.router)

@app.get("/")
def read_root():
    return {"service": "Appointment Service (Python-Only)"}

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8003)