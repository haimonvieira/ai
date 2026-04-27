from enum import Enum


class LLMProvider(str, Enum):
    """Provedores de LLM suportados"""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"
    AZURE_OPENAI = "azure_openai"
    OLLAMA = "ollama"
    GROQ = "groq"


class AgentStatus(str, Enum):
    """Status de um agente"""
    IDLE = "idle"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    ERROR = "error"


class MemoryType(str, Enum):
    """Tipos de memória"""
    SHORT_TERM = "short_term"
    LONG_TERM = "long_term"
    EPISODIC = "episodic"
    SEMANTIC = "semantic"


class DocumentStatus(str, Enum):
    """Status de processamento de documento"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    ERROR = "error"


class ToolType(str, Enum):
    """Tipos de ferramentas disponíveis"""
    WEB_SEARCH = "web_search"
    CALCULATOR = "calculator"
    CODE_INTERPRETER = "code_interpreter"
    FILE_PROCESSOR = "file_processor"
    API_CALLER = "api_caller"
    CUSTOM = "custom"
