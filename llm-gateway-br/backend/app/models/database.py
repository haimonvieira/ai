from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, JSON, Float
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime
import uuid

Base = declarative_base()


def generate_uuid():
    return str(uuid.uuid4())


class User(Base):
    """Modelo de usuário (opcional, já que é BYOK)"""
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String, unique=True, nullable=True)  # Opcional
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relacionamentos
    api_keys = relationship("APIKey", back_populates="user", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="user", cascade="all, delete-orphan")
    agents = relationship("Agent", back_populates="user", cascade="all, delete-orphan")


class APIKey(Base):
    """Chaves de API dos usuários (BYOK)"""
    __tablename__ = "api_keys"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)  # Pode ser null para uso sem auth
    provider = Column(String, nullable=False)  # openai, anthropic, google, etc.
    key_name = Column(String, nullable=False)  # Nome amigável para a chave
    encrypted_key = Column(Text, nullable=False)  # Chave criptografada
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_used_at = Column(DateTime, nullable=True)
    
    # Relacionamentos
    user = relationship("User", back_populates="api_keys")


class Conversation(Base):
    """Conversas com LLM"""
    __tablename__ = "conversations"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    title = Column(String, default="Nova Conversa")
    provider = Column(String, nullable=False)
    model = Column(String, nullable=False)
    system_prompt = Column(Text, nullable=True)
    temperature = Column(Float, default=0.7)
    max_tokens = Column(Integer, default=2048)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relacionamentos
    user = relationship("User", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan", order_by="Message.created_at")
    memories = relationship("Memory", back_populates="conversation", cascade="all, delete-orphan")


class Message(Base):
    """Mensagens das conversas"""
    __tablename__ = "messages"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    conversation_id = Column(String, ForeignKey("conversations.id"), nullable=False)
    role = Column(String, nullable=False)  # user, assistant, system
    content = Column(Text, nullable=False)
    metadata = Column(JSON, nullable=True)  # Tokens usados, tempo de resposta, etc.
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relacionamentos
    conversation = relationship("Conversation", back_populates="messages")


class Memory(Base):
    """Sistema de memórias para conversas"""
    __tablename__ = "memories"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    conversation_id = Column(String, ForeignKey("conversations.id"), nullable=False)
    memory_type = Column(String, nullable=False)  # short_term, long_term, episodic, semantic
    content = Column(Text, nullable=False)
    embedding = Column(JSON, nullable=True)  # Vetor de embedding para busca
    importance_score = Column(Float, default=0.0)  # Score de importância
    access_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)
    
    # Relacionamentos
    conversation = relationship("Conversation", back_populates="memories")


class Document(Base):
    """Documentos para RAG"""
    __tablename__ = "documents"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)  # em bytes
    file_type = Column(String, nullable=False)  # pdf, txt, docx, etc.
    status = Column(String, default="pending")  # pending, processing, completed, error
    chunk_count = Column(Integer, default=0)
    metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)
    
    # Relacionamentos
    user = relationship("User", back_populates="documents")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")


class DocumentChunk(Base):
    """Chunks de documentos para busca vetorial"""
    __tablename__ = "document_chunks"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    document_id = Column(String, ForeignKey("documents.id"), nullable=False)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    embedding = Column(JSON, nullable=True)  # Vetor de embedding
    metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relacionamentos
    document = relationship("Document", back_populates="chunks")


class Agent(Base):
    """Agentes autônomos"""
    __tablename__ = "agents"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    goal = Column(Text, nullable=False)  # Objetivo do agente
    system_prompt = Column(Text, nullable=True)
    provider = Column(String, nullable=False)
    model = Column(String, nullable=False)
    tools = Column(JSON, nullable=True)  # Lista de ferramentas disponíveis
    status = Column(String, default="idle")  # idle, running, paused, completed, error
    config = Column(JSON, nullable=True)  # Configurações adicionais
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relacionamentos
    user = relationship("User", back_populates="agents")
    executions = relationship("AgentExecution", back_populates="agent", cascade="all, delete-orphan")


class AgentExecution(Base):
    """Execuções de agentes"""
    __tablename__ = "agent_executions"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    agent_id = Column(String, ForeignKey("agents.id"), nullable=False)
    status = Column(String, default="running")
    input_data = Column(Text, nullable=True)
    output_data = Column(Text, nullable=True)
    steps = Column(JSON, nullable=True)  # Passos executados
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    # Relacionamentos
    agent = relationship("Agent", back_populates="executions")


class Tool(Base):
    """Ferramentas customizadas"""
    __tablename__ = "tools"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    tool_type = Column(String, nullable=False)
    config = Column(JSON, nullable=True)  # Configuração da ferramenta
    code = Column(Text, nullable=True)  # Código customizado (para ferramentas custom)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relacionamentos
    user = relationship("User")
