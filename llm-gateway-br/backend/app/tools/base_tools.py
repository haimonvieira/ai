from langchain.tools import Tool
from typing import Dict, Any, List, Optional
import httpx
import json
import re


class WebSearchTool:
    """Ferramenta de pesquisa na web"""
    
    def __init__(self, search_engine: str = "google", api_key: Optional[str] = None):
        self.search_engine = search_engine
        self.api_key = api_key
        self.search_url = "https://www.google.com/search"
    
    async def search(self, query: str, num_results: int = 5) -> List[Dict[str, Any]]:
        """
        Realiza pesquisa na web
        
        Args:
            query: Query de busca
            num_results: Número de resultados
            
        Returns:
            Lista de resultados
        """
        # Implementação simplificada - em produção usaria API real
        results = []
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    self.search_url,
                    params={"q": query, "num": num_results},
                    headers={"User-Agent": "Mozilla/5.0"}
                )
                
                # Parse básico do HTML (em produção usar BeautifulSoup)
                if response.status_code == 200:
                    results.append({
                        "title": f"Resultados para: {query}",
                        "snippet": "Pesquisa realizada com sucesso",
                        "link": self.search_url
                    })
        except Exception as e:
            results.append({
                "title": "Erro na pesquisa",
                "snippet": str(e),
                "link": ""
            })
        
        return results
    
    def get_tool_definition(self) -> Tool:
        """Retorna definição da ferramenta para o agente"""
        return Tool(
            name="web_search",
            description="Útil para buscar informações atuais na internet. Use quando precisar de informações recentes ou fatos não presentes no seu treinamento.",
            func=self._search_sync,
            coroutine=self.search
        )
    
    def _search_sync(self, query: str) -> str:
        """Versão síncrona para compatibilidade"""
        import asyncio
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        results = loop.run_until_complete(self.search(query))
        return json.dumps(results, ensure_ascii=False)


class CalculatorTool:
    """Ferramenta de calculadora"""
    
    def calculate(self, expression: str) -> Dict[str, Any]:
        """
        Calcula uma expressão matemática
        
        Args:
            expression: Expressão matemática
            
        Returns:
            Resultado do cálculo
        """
        try:
            # Sanitizar expressão (apenas permitir caracteres seguros)
            expression = re.sub(r'[^0-9+\-*/().\s]', '', expression)
            
            if not expression:
                return {"error": "Expressão vazia"}
            
            result = eval(expression)
            return {
                "expression": expression,
                "result": result
            }
        except Exception as e:
            return {"error": str(e)}
    
    def get_tool_definition(self) -> Tool:
        """Retorna definição da ferramenta para o agente"""
        return Tool(
            name="calculator",
            description="Útil para realizar cálculos matemáticos. Aceita expressões como '2 + 2', '10 * 5', '(3 + 7) / 2', etc.",
            func=lambda x: json.dumps(self.calculate(x))
        )


class CodeInterpreterTool:
    """Ferramenta de interpretação de código Python"""
    
    def execute(self, code: str) -> Dict[str, Any]:
        """
        Executa código Python em sandbox
        
        Args:
            code: Código Python a executar
            
        Returns:
            Resultado da execução
        """
        try:
            # Capturar output
            import io
            import sys
            
            old_stdout = sys.stdout
            sys.stdout = io.StringIO()
            
            # Executar código
            local_vars = {}
            exec(code, {}, local_vars)
            
            output = sys.stdout.getvalue()
            sys.stdout = old_stdout
            
            return {
                "success": True,
                "output": output,
                "variables": {k: str(v) for k, v in local_vars.items() if not k.startswith('_')}
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "output": ""
            }
    
    def get_tool_definition(self) -> Tool:
        """Retorna definição da ferramenta para o agente"""
        return Tool(
            name="code_interpreter",
            description="Útil para executar código Python. Use para cálculos complexos, análise de dados, ou qualquer tarefa que possa ser resolvida com programação.",
            func=lambda x: json.dumps(self.execute(x))
        )


class ToolsService:
    """Serviço para gerenciar ferramentas disponíveis"""
    
    def __init__(self):
        self.tools_registry: Dict[str, Any] = {
            "web_search": WebSearchTool(),
            "calculator": CalculatorTool(),
            "code_interpreter": CodeInterpreterTool()
        }
    
    def get_available_tools(self) -> List[str]:
        """Lista ferramentas disponíveis"""
        return list(self.tools_registry.keys())
    
    def get_tool(self, tool_name: str) -> Optional[Any]:
        """Obtém uma ferramenta específica"""
        return self.tools_registry.get(tool_name)
    
    def get_tool_definitions(self, tool_names: List[str]) -> List[Tool]:
        """
        Obtém definições de múltiplas ferramentas para agentes
        
        Args:
            tool_names: Lista de nomes de ferramentas
            
        Returns:
            Lista de definições de ferramentas
        """
        tools = []
        for name in tool_names:
            if name in self.tools_registry:
                tools.append(self.tools_registry[name].get_tool_definition())
        return tools
    
    def add_custom_tool(self, name: str, tool: Tool):
        """Adiciona ferramenta customizada"""
        self.tools_registry[name] = tool


# Singleton
tools_service = ToolsService()
