from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

from app.services.agent_service import agent_service, memory_service
from app.services.llm_service import llm_service
from app.tools.base_tools import tools_service


router = APIRouter(prefix="/api/v1/agents", tags=["Agentes"])


class AgentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    goal: str
    provider: str = "openai"
    model: str = "gpt-3.5-turbo"
    api_key: str
    tools: List[str] = ["calculator"]
    system_prompt: Optional[str] = None
    memory_type: str = "short"


class AgentRunRequest(BaseModel):
    agent_id: str
    input: str
    api_key: Optional[str] = None


class AgentResponse(BaseModel):
    success: bool
    output: Optional[str]
    error: Optional[str] = None
    intermediate_steps: Optional[List[Any]] = None


@router.post("/create")
async def create_agent(request: AgentCreate):
    """
    Cria um novo agente com ferramentas e memória
    
    O agente pode usar múltiplas ferramentas e tem memória de conversação
    """
    try:
        # Gerar ID único
        import uuid
        agent_id = f"agent_{uuid.uuid4().hex[:8]}"
        
        # Obter LLM
        llm = llm_service.get_llm(
            provider=request.provider,
            api_key=request.api_key,
            model=request.model,
            temperature=0.7,
            max_tokens=2048
        )
        
        # Obter ferramentas selecionadas
        tool_definitions = tools_service.get_tool_definitions(request.tools)
        
        # System prompt padrão se não fornecido
        system_prompt = request.system_prompt or (
            f"Você é um assistente útil chamado {request.name}. "
            f"Seu objetivo é: {request.goal}. "
            "Use as ferramentas disponíveis quando necessário para ajudar o usuário. "
            "Sempre explique seu raciocínio."
        )
        
        # Criar agente
        agent_executor = agent_service.create_agent(
            agent_id=agent_id,
            llm=llm,
            tools=tool_definitions,
            system_prompt=system_prompt,
            memory_type=request.memory_type
        )
        
        return {
            "success": True,
            "agent_id": agent_id,
            "name": request.name,
            "goal": request.goal,
            "tools": request.tools,
            "memory_type": request.memory_type,
            "message": "Agente criado com sucesso"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/run", response_model=AgentResponse)
async def run_agent(request: AgentRunRequest):
    """
    Executa um agente com um input do usuário
    """
    try:
        result = agent_service.run_agent(
            agent_id=request.agent_id,
            input_data=request.input
        )
        
        return AgentResponse(
            success=result["success"],
            output=result.get("output"),
            error=result.get("error"),
            intermediate_steps=result.get("intermediate_steps")
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tools")
async def list_tools():
    """Lista todas as ferramentas disponíveis"""
    tools = tools_service.get_available_tools()
    return {"tools": tools}


@router.get("/tools/{tool_name}/info")
async def get_tool_info(tool_name: str):
    """Obtém informações sobre uma ferramenta específica"""
    tool = tools_service.get_tool(tool_name)
    
    if not tool:
        raise HTTPException(status_code=404, detail="Ferramenta não encontrada")
    
    return {
        "name": tool_name,
        "description": tool.__doc__ or "Sem descrição",
        "available": True
    }


@router.delete("/{agent_id}")
async def delete_agent(agent_id: str):
    """Deleta um agente e sua memória"""
    try:
        agent_service.delete_agent(agent_id)
        return {"success": True, "message": f"Agente {agent_id} deletado"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Endpoints de Memória

@router.get("/memory/{conversation_id}")
async def get_memory(conversation_id: str, memory_type: str = "short"):
    """Obtém a memória de uma conversa"""
    memory = memory_service.get_memory(conversation_id, memory_type)
    
    if not memory:
        return {"memory": None, "message": "Nenhuma memória encontrada"}
    
    # Extrair histórico da memória
    if hasattr(memory, 'chat_history'):
        history = memory.chat_history
    else:
        history = []
    
    return {
        "conversation_id": conversation_id,
        "memory_type": memory_type,
        "history": [{"role": msg.type, "content": msg.content} for msg in history]
    }


@router.delete("/memory/{conversation_id}")
async def clear_memory(conversation_id: str, memory_type: Optional[str] = None):
    """Limpa a memória de uma conversa"""
    try:
        memory_service.clear_memory(conversation_id, memory_type)
        return {
            "success": True,
            "message": f"Memória {'parcial ' if memory_type else ''}limpa para {conversation_id}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
