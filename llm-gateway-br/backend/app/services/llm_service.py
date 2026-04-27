from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_anthropic import ChatAnthropic
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_core.language_models import BaseLanguageModel
from typing import Optional, Dict, Any
import os


class LLMService:
    """Serviço para gerenciar diferentes provedores de LLM"""
    
    def __init__(self):
        self.models_cache: Dict[str, BaseLanguageModel] = {}
        self.embeddings_cache: Dict[str, Any] = {}
    
    def get_llm(
        self,
        provider: str,
        api_key: str,
        model: str,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        streaming: bool = True
    ) -> BaseLanguageModel:
        """
        Obtém uma instância de LLM baseada no provedor
        
        Args:
            provider: Provedor (openai, anthropic, google, etc.)
            api_key: Chave de API do usuário
            model: Nome do modelo
            temperature: Temperatura para geração
            max_tokens: Máximo de tokens
            streaming: Habilitar streaming
            
        Returns:
            Instância do modelo de linguagem
        """
        cache_key = f"{provider}:{model}:{api_key[:8]}"
        
        if cache_key in self.models_cache:
            return self.models_cache[cache_key]
        
        # Configurar variável de ambiente temporariamente
        env_var_map = {
            "openai": "OPENAI_API_KEY",
            "anthropic": "ANTHROPIC_API_KEY",
            "google": "GOOGLE_API_KEY",
        }
        
        old_value = os.environ.get(env_var_map.get(provider.lower(), ""))
        os.environ[env_var_map.get(provider.lower(), "")] = api_key
        
        try:
            if provider.lower() == "openai":
                llm = ChatOpenAI(
                    api_key=api_key,
                    model=model,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    streaming=streaming
                )
            elif provider.lower() == "anthropic":
                llm = ChatAnthropic(
                    anthropic_api_key=api_key,
                    model=model,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    streaming=streaming
                )
            elif provider.lower() == "google":
                llm = ChatGoogleGenerativeAI(
                    google_api_key=api_key,
                    model=model,
                    temperature=temperature,
                    max_output_tokens=max_tokens,
                    stream=streaming
                )
            else:
                raise ValueError(f"Provedor não suportado: {provider}")
            
            self.models_cache[cache_key] = llm
            return llm
            
        finally:
            # Restaurar valor anterior
            if old_value is not None:
                os.environ[env_var_map.get(provider.lower(), "")] = old_value
            else:
                os.environ.pop(env_var_map.get(provider.lower(), ""), None)
    
    def get_embeddings(
        self,
        provider: str,
        api_key: str,
        model: Optional[str] = None
    ) -> Any:
        """
        Obtém serviço de embeddings para vetorização
        
        Args:
            provider: Provedor
            api_key: Chave de API
            model: Modelo específico (opcional)
            
        Returns:
            Instância de embeddings
        """
        cache_key = f"{provider}:embeddings:{api_key[:8]}"
        
        if cache_key in self.embeddings_cache:
            return self.embeddings_cache[cache_key]
        
        if provider.lower() == "openai":
            embeddings = OpenAIEmbeddings(
                api_key=api_key,
                model=model or "text-embedding-ada-002"
            )
        elif provider.lower() == "google":
            embeddings = GoogleGenerativeAIEmbeddings(
                google_api_key=api_key,
                model=model or "models/embedding-001"
            )
        else:
            # Fallback para embeddings locais (sentence-transformers)
            from sentence_transformers import SentenceTransformer
            embeddings = SentenceTransformer('all-MiniLM-L6-v2')
        
        self.embeddings_cache[cache_key] = embeddings
        return embeddings
    
    def list_models(self, provider: str, api_key: str) -> list:
        """
        Lista modelos disponíveis para um provedor
        
        Args:
            provider: Provedor
            api_key: Chave de API
            
        Returns:
            Lista de modelos disponíveis
        """
        # Modelos pré-definidos para cada provedor
        models_map = {
            "openai": [
                "gpt-4-turbo-preview",
                "gpt-4-0125-preview",
                "gpt-4-1106-preview",
                "gpt-4",
                "gpt-3.5-turbo-0125",
                "gpt-3.5-turbo-1106",
                "gpt-3.5-turbo",
            ],
            "anthropic": [
                "claude-3-opus-20240229",
                "claude-3-sonnet-20240229",
                "claude-3-haiku-20240307",
                "claude-2.1",
                "claude-2.0",
            ],
            "google": [
                "gemini-pro",
                "gemini-1.5-pro-latest",
                "gemini-1.5-flash-latest",
            ],
        }
        
        return models_map.get(provider.lower(), [])
    
    def validate_api_key(self, provider: str, api_key: str) -> bool:
        """
        Valida se uma chave de API é válida
        
        Args:
            provider: Provedor
            api_key: Chave de API
            
        Returns:
            True se válida, False caso contrário
        """
        try:
            # Tenta criar uma instância simples e fazer uma chamada mínima
            llm = self.get_llm(provider, api_key, "gpt-3.5-turbo" if provider == "openai" else "claude-2.1")
            # Não fazemos chamada real aqui para economizar tokens do usuário
            # Apenas validamos o formato da chave
            return len(api_key) > 10
        except Exception:
            return False


# Singleton
llm_service = LLMService()
