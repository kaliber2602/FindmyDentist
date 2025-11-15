 
import uvicorn
from fastapi import FastAPI
from . import routes 
from fastapi.middleware.cors import CORSMiddleware
app = FastAPI()

app.include_router(routes.router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500"],  # domain frontend (Live Server)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"service": "Customer Service (Python-Only)"}

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8005)