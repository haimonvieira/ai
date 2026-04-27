# LLM Gateway BR - Plataforma Gratuita com BYOK

Uma plataforma open-source que permite aos usuários utilizar recursos avançados de LLM (RAG, Memórias, Agentes, Pesquisa e Ferramentas) de forma gratuita, utilizando suas próprias chaves de API (BYOK - Bring Your Own Key).

## 🚀 Funcionalidades

- **RAG (Retrieval-Augmented Generation)**: Upload de documentos e busca semântica para respostas contextualizadas
- **Memórias**: Sistema de memória de curto e longo prazo para conversas contínuas
- **Agentes**: Criação e execução de agentes autônomos com objetivos específicos
- **Pesquisa**: Integração com ferramentas de busca na web
- **Ferramentas**: Sistema extensível de ferramentas customizáveis
- **BYOK**: Usuários fornecem suas próprias chaves de API (OpenAI, Anthropic, Google, etc.)

## 🛠️ Stack Tecnológica

### Backend
- **Python** com FastAPI
- **LangChain** para orquestração de LLMs
- **ChromaDB** ou **Qdrant** para vetorização e busca (RAG)
- **SQLAlchemy** para persistência de dados
- **Redis** para cache e sessões

### Frontend
- **React** com TypeScript
- **TailwindCSS** para estilização
- **React Query** para gerenciamento de estado
- **WebSocket** para streaming de respostas

## 📦 Estrutura do Projeto

```
llm-gateway-br/
├── backend/
│   ├── app/
│   │   ├── api/          # Endpoints da API
│   │   ├── core/         # Configurações e segurança
│   │   ├── models/       # Modelos de dados
│   │   ├── services/     # Serviços de LLM, RAG, Agentes
│   │   ├── tools/        # Implementação de ferramentas
│   │   └── main.py       # Ponto de entrada
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/   # Componentes React
│   │   ├── pages/        # Páginas da aplicação
│   │   ├── hooks/        # Custom hooks
│   │   └── App.tsx
│   ├── package.json
│   └── Dockerfile
└── README.md
```

## 🔧 Instalação

### Pré-requisitos
- Python 3.10+
- Node.js 18+
- Docker (opcional)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## 🔑 Configuração de Chaves API

Os usuários podem configurar suas chaves diretamente na interface:
- OpenAI API Key
- Anthropic API Key
- Google Gemini API Key
- Azure OpenAI Key
- E outros provedores suportados

## 📝 Licença

MIT License

## 🤝 Contribuição

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues e pull requests.
