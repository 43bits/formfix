from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_name: str = "FitAI"
    debug: bool = True
    database_url: str = "postgresql+asyncpg://fitai:fitai@localhost/fitai"
    redis_url: str = "redis://localhost:6379"
    secret_key: str = "change-me-in-production"
    model_dir: str = "ml/models"
    max_video_mb: int = 500
    ws_frame_interval_ms: int = 33  # ~30fps

    class Config:
        env_file = ".env"
        protected_namespaces = ("settings_",)   # ← add this line

settings = Settings()