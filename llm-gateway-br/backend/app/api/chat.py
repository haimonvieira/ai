from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import json
import asyncio

from app.services.llm_service import llm_service
from app.core.enums import LLMProvider


router = APIRouter(prefix="/api/v1/chat", tags=["Chat"])


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    provider: str = Field(..., description="Provedor (openai, anthropic, google)")
    api_key: str = Field(..., description="Chave de API do usuário")
    model: str = Field(..., description="Modelo a ser usado")
    messages: List[ChatMessage] = Field(..., description="Histórico da conversa")
    system_prompt: Optional[str] = Field(None, description="Prompt do sistema")
    temperature: float = Field(0.7, ge=0, le=2, description="Temperatura")
    max_tokens: int = Field(2048, gt=0, description="Máximo de tokens")
    stream: bool = Field(True, description="Habilitar streaming")


class ChatResponse(BaseModel):
    id: str
    content: str
    model: str
    usage: Optional[Dict[str, int]] = None


@router.post("/completions", response_model=ChatResponse)
async def create_completion(request: ChatRequest):
    """
    Cria uma completude de chat usando o provedor especificado
    
    O usuário fornece sua própria chave de API (BYOK)
    """
    try:
        # Obter instância do LLM
        llm = llm_service.get_llm(
            provider=request.provider,
            api_key=request.api_key,
            model=request.model,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
            streaming=False  # Desativar para resposta única
        )
        
        # Preparar mensagens
        messages = []
        
        # Adicionar system prompt se existir
        if request.system_prompt:
            messages.append(("system", request.system_prompt))
        
        # Adicionar histórico
        for msg in request.messages:
            messages.append((msg.role, msg.content))
        
        # Invocar LLM
        from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
        
        langchain_messages = []
        for role, content in messages:
            if role == "system":
                langchain_messages.append(SystemMessage(content=content))
            elif role == "user":
                langchain_messages.append(HumanMessage(content=content))
            else:
                langchain_messages.append(AIMessage(content=content))
        
        response = llm.invoke(langchain_messages)
        
        return ChatResponse(
            id=f"chatcmpl-{asyncio.get_event_loop().time()}",
            content=response.content,
            model=request.model,
            usage={"total_tokens": len(response.content) // 4}  # Estimativa
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/completions/stream")
async def create_streaming_completion(request: ChatRequest):
    """
    Cria uma completude de chat com streaming
    
    Retorna uma stream SSE com os tokens sendo gerados
    """
    try:
        # Obter instância do LLM
        llm = llm_service.get_llm(
            provider=request.provider,
            api_key=request.api_key,
            model=request.model,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
            streaming=True
        )
        
        # Preparar mensagens
        from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
        
        messages = []
        if request.system_prompt:
            messages.append(SystemMessage(content=request.system_prompt))
        
        for msg in request.messages:
            if msg.role == "user":
                messages.append(HumanMessage(content=msg.content))
            else:
                messages.append(AIMessage(content=msg.content))
        
        # Generator para streaming
        async def generate():
            try:
                async for chunk in llm.astream(messages):
                    if hasattr(chunk, 'content') and chunk.content:
                        data = {
                            "id": f"chatcmpl-{asyncio.get_event_loop().time()}",
                            "choices": [
                                {
                                    "delta": {"content": chunk.content},
                                    "index": 0,
                                    "finish_reason": None
                                }
                            ]
                        }
                        yield f"data: {json.dumps(data)}\n\n"
                
                # Sinalizar fim
                yield "data: [DONE]\n\n"
                
            except Exception as e:
                error_data = {"error": str(e)}
                yield f"data: {json.dumps(error_data)}\n\n"
        
        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/models/{provider}")
async def list_models(provider: str, api_key: str = Query(...)):
    """
    Lista modelos disponíveis para um provedor
    """
    try:
        models = llm_service.list_models(provider, api_key)
        return {"provider": provider, "models": models}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/validate-key")
async def validate_api_key(provider: str, api_key: str):
    """
    Valida se uma chave de API é válida
    """
    is_valid = llm_service.validate_api_key(provider, api_key)
    return {"valid": is_valid, "provider": provider}
