from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from contextlib import asynccontextmanager
import os

from app.core.config import settings
from app.api import chat, rag, agents


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gerencia o ciclo de vida da aplicação"""
    # Startup
    print(f"🚀 Iniciando {settings.APP_NAME} v{settings.APP_VERSION}")
    print(f"📁 Diretório de trabalho: {os.getcwd()}")
    
    # Criar diretórios necessários
    os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)
    os.makedirs("./uploads", exist_ok=True)
    
    yield
    
    # Shutdown
    print("👋 Encerrando aplicação...")


# Criar aplicação FastAPI
app = FastAPI(
    title=settings.APP_NAME,
    description="Plataforma gratuita para utilizar RAG, Memórias, Agentes, Pesquisa e Ferramentas com BYOK",
    version=settings.APP_VERSION,
    lifespan=lifespan
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Em produção, especificar origens permitidas
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir routers das APIs
app.include_router(chat.router)
app.include_router(rag.router)
app.include_router(agents.router)


@app.get("/", response_class=HTMLResponse)
async def root():
    """Página inicial com documentação básica"""
    html_content = f"""
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{settings.APP_NAME}</title>
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
                max-width: 800px;
                margin: 0 auto;
                padding: 40px 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
            }}
            .container {{
                background: white;
                border-radius: 12px;
                padding: 40px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            }}
            h1 {{ color: #667eea; margin-bottom: 10px; }}
            .subtitle {{ color: #666; margin-bottom: 30px; }}
            .feature {{
                background: #f8f9fa;
                border-left: 4px solid #667eea;
                padding: 15px 20px;
                margin: 15px 0;
                border-radius: 0 8px 8px 0;
            }}
            .feature h3 {{ margin: 0 0 8px 0; color: #333; }}
            .feature p {{ margin: 0; color: #666; }}
            .api-links {{
                margin-top: 30px;
                display: flex;
                gap: 15px;
                flex-wrap: wrap;
            }}
            .api-link {{
                background: #667eea;
                color: white;
                padding: 12px 24px;
                border-radius: 8px;
                text-decoration: none;
                font-weight: 500;
                transition: transform 0.2s;
            }}
            .api-link:hover {{
                transform: translateY(-2px);
                background: #5568d3;
            }}
            .byok-badge {{
                display: inline-block;
                background: #10b981;
                color: white;
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 14px;
                font-weight: 600;
                margin-top: 10px;
            }}
            code {{
                background: #f1f5f9;
                padding: 2px 6px;
                border-radius: 4px;
                font-family: 'Courier New', monospace;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🚀 {settings.APP_NAME}</h1>
            <p class="subtitle">Versão {settings.APP_VERSION}</p>
            
            <div class="byok-badge">🔑 BYOK - Bring Your Own Key</div>
            
            <p style="margin-top: 20px; color: #555;">
                Uma plataforma gratuita que permite utilizar recursos avançados de LLM 
                usando suas próprias chaves de API. Sem custos ocultos, sem limitações!
            </p>
            
            <h2 style="color: #333; margin-top: 30px;">✨ Funcionalidades</h2>
            
            <div class="feature">
                <h3>💬 Chat com LLMs</h3>
                <p>Converse com modelos da OpenAI, Anthropic, Google e mais. Suporte a streaming em tempo real.</p>
            </div>
            
            <div class="feature">
                <h3>📚 RAG (Retrieval-Augmented Generation)</h3>
                <p>Upload de documentos (PDF, TXT, DOCX) e busca semântica para respostas contextualizadas.</p>
            </div>
            
            <div class="feature">
                <h3>🧠 Memórias</h3>
                <p>Sistema de memória de curto e longo prazo para conversas contínuas e coerentes.</p>
            </div>
            
            <div class="feature">
                <h3>🤖 Agentes</h3>
                <p>Crie agentes autônomos com objetivos específicos e ferramentas customizáveis.</p>
            </div>
            
            <div class="feature">
                <h3>🔧 Ferramentas</h3>
                <p>Pesquisa na web, calculadora, interpretador de código e mais.</p>
            </div>
            
            <h2 style="color: #333; margin-top: 30px;">📡 API Endpoints</h2>
            
            <div class="api-links">
                <a href="/docs" class="api-link">📖 Swagger Docs</a>
                <a href="/redoc" class="api-link">📄 ReDoc</a>
                <a href="/api/v1/chat/completions" class="api-link">💬 Chat API</a>
                <a href="/api/v1/rag/upload" class="api-link">📚 RAG API</a>
                <a href="/api/v1/agents/create" class="api-link">🤖 Agents API</a>
            </div>
            
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #888; font-size: 14px;">
                <p><strong>Como usar:</strong></p>
                <ol style="line-height: 1.8;">
                    <li>Obtenha sua chave de API do provedor desejado (OpenAI, Anthropic, etc.)</li>
                    <li>Faça requisições para a API incluindo sua chave no payload</li>
                    <li>Use <code>/api/v1/chat/completions</code> para chat simples</li>
                    <li>Use <code>/api/v1/rag/upload</code> para upload de documentos</li>
                    <li>Use <code>/api/v1/agents/create</code> para criar agentes</li>
                </ol>
            </div>
        </div>
    </body>
    </html>
    """
    return html_content


@app.get("/health")
async def health_check():
    """Endpoint de saúde da API"""
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "debug": settings.DEBUG
    }


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )
