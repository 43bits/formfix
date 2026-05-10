from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import stream, analysis
from .routers import sports, emotion   # add sports, emotion

app = FastAPI(title="FitAI", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stream.router)
app.include_router(analysis.router)
app.include_router(sports.router)
app.include_router(emotion.router)

@app.get("/health")
async def health():
    return {"status": "ok"}