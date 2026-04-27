from pydantic_settings import BaseSettings
from typing import Optional, List


class Settings(BaseSettings):
    """Configurações da aplicação"""
    
    # App
    APP_NAME: str = "LLM Gateway BR"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True
    
    # Servidor
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # Banco de dados
    DATABASE_URL: str = "sqlite+aiosqlite:///./llm_gateway.db"
    
    # Redis (opcional)
    REDIS_URL: Optional[str] = "redis://localhost:6379"
    
    # ChromaDB para RAG
    CHROMA_PERSIST_DIR: str = "./chroma_db"
    
    # Limites
    MAX_FILE_SIZE_MB: int = 50
    MAX_TOKENS: int = 4096
    MAX_CONVERSATION_HISTORY: int = 50
    
    # Segurança
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 dias
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
