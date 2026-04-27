# Backend

## Instalação

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou
venv\Scripts\activate  # Windows

pip install -r requirements.txt
```

## Executar

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

A API estará disponível em: http://localhost:8000
Documentação Swagger: http://localhost:8000/docs

## Variáveis de Ambiente

Crie um arquivo `.env` na pasta backend:

```env
APP_NAME=LLM Gateway BR
DEBUG=True
DATABASE_URL=sqlite+aiosqlite:///./llm_gateway.db
CHROMA_PERSIST_DIR=./chroma_db
SECRET_KEY=sua-chave-secreta-aqui
```

# Frontend

## Instalação

```bash
cd frontend
npm install
```

## Executar

```bash
npm run dev
```

O frontend estará disponível em: http://localhost:3000

## Build

```bash
npm run build
```

# Docker (Opcional)

## Backend

```bash
docker build -t llm-gateway-br-backend ./backend
docker run -p 8000:8000 llm-gateway-br-backend
```

## Frontend

```bash
docker build -t llm-gateway-br-frontend ./frontend
docker run -p 3000:80 frontend
```

# Testando a API

## Chat simples

```bash
curl -X POST http://localhost:8000/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "api_key": "sua-chave-aqui",
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Olá!"}],
    "stream": false
  }'
```

## Upload de documento (RAG)

```bash
curl -X POST http://localhost:8000/api/v1/rag/upload \
  -F "file=@documento.pdf" \
  -F "collection_name=minha_colecao" \
  -F "api_key=sua-chave-aqui" \
  -F "provider=openai"
```

## Criar Agente

```bash
curl -X POST http://localhost:8000/api/v1/agents/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Assistente",
    "goal": "Ajudar usuários com dúvidas",
    "provider": "openai",
    "api_key": "sua-chave-aqui",
    "tools": ["calculator"]
  }'
```
