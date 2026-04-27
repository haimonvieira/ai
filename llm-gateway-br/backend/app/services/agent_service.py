from langchain.agents import AgentExecutor, create_openai_functions_agent, Tool
from langchain.memory import ConversationBufferMemory, ConversationSummaryMemory
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from typing import List, Dict, Any, Optional
import json


class MemoryService:
    """Serviço para gerenciamento de memórias"""
    
    def __init__(self):
        self.memories: Dict[str, Any] = {}
    
    def create_short_term_memory(
        self,
        conversation_id: str,
        max_tokens: int = 2000
    ) -> ConversationBufferMemory:
        """
        Cria memória de curto prazo para uma conversa
        
        Args:
            conversation_id: ID da conversa
            max_tokens: Máximo de tokens na memória
            
        Returns:
            Instância de memória
        """
        memory = ConversationBufferMemory(
            memory_key="chat_history",
            return_messages=True,
            max_token_limit=max_tokens
        )
        self.memories[f"short:{conversation_id}"] = memory
        return memory
    
    def create_summary_memory(
        self,
        conversation_id: str,
        llm: Any
    ) -> ConversationSummaryMemory:
        """
        Cria memória de resumo para conversas longas
        
        Args:
            conversation_id: ID da conversa
            llm: Instância do LLM para gerar resumos
            
        Returns:
            Instância de memória de resumo
        """
        memory = ConversationSummaryMemory(
            llm=llm,
            memory_key="chat_history",
            return_messages=True
        )
        self.memories[f"summary:{conversation_id}"] = memory
        return memory
    
    def get_memory(self, conversation_id: str, memory_type: str = "short") -> Optional[Any]:
        """Obtém memória existente"""
        key = f"{memory_type}:{conversation_id}"
        return self.memories.get(key)
    
    def clear_memory(self, conversation_id: str, memory_type: Optional[str] = None):
        """Limpa memórias de uma conversa"""
        if memory_type:
            key = f"{memory_type}:{conversation_id}"
            if key in self.memories:
                del self.memories[key]
        else:
            # Limpar todas as memórias da conversa
            keys_to_delete = [k for k in self.memories if conversation_id in k]
            for key in keys_to_delete:
                del self.memories[key]


class AgentService:
    """Serviço para criação e execução de agentes"""
    
    def __init__(self):
        self.agents: Dict[str, Any] = {}
        self.memory_service = MemoryService()
    
    def create_agent(
        self,
        agent_id: str,
        llm: Any,
        tools: List[Tool],
        system_prompt: str,
        memory_type: str = "short"
    ) -> AgentExecutor:
        """
        Cria um agente com ferramentas e memória
        
        Args:
            agent_id: ID único do agente
            llm: Instância do LLM
            tools: Lista de ferramentas disponíveis
            system_prompt: Prompt do sistema
            memory_type: Tipo de memória (short, summary)
            
        Returns:
            Executor do agente
        """
        # Criar prompt template
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            MessagesPlaceholder(variable_name="chat_history"),
            ("human", "{input}"),
            MessagesPlaceholder(variable_name="agent_scratchpad")
        ])
        
        # Criar memória
        if memory_type == "summary":
            memory = self.memory_service.create_summary_memory(agent_id, llm)
        else:
            memory = self.memory_service.create_short_term_memory(agent_id)
        
        # Criar agente OpenAI Functions
        agent = create_openai_functions_agent(llm, tools, prompt)
        
        # Criar executor
        agent_executor = AgentExecutor(
            agent=agent,
            tools=tools,
            memory=memory,
            verbose=True,
            handle_parsing_errors=True
        )
        
        self.agents[agent_id] = agent_executor
        return agent_executor
    
    def run_agent(
        self,
        agent_id: str,
        input_data: str,
        callbacks: Optional[List[Any]] = None
    ) -> Dict[str, Any]:
        """
        Executa um agente com input do usuário
        
        Args:
            agent_id: ID do agente
            input_data: Input do usuário
            callbacks: Callbacks opcionais para streaming
            
        Returns:
            Resultado da execução
        """
        if agent_id not in self.agents:
            raise ValueError(f"Agente {agent_id} não encontrado")
        
        agent_executor = self.agents[agent_id]
        
        try:
            result = agent_executor.invoke(
                {"input": input_data},
                callbacks=callbacks
            )
            
            return {
                "success": True,
                "output": result.get("output", ""),
                "intermediate_steps": result.get("intermediate_steps", [])
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "output": None
            }
    
    def get_agent(self, agent_id: str) -> Optional[AgentExecutor]:
        """Obtém um agente existente"""
        return self.agents.get(agent_id)
    
    def delete_agent(self, agent_id: str):
        """Deleta um agente e sua memória"""
        if agent_id in self.agents:
            del self.agents[agent_id]
        self.memory_service.clear_memory(agent_id)


# Singleton
agent_service = AgentService()
memory_service = MemoryService()
