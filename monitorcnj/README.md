# ⚖️ MonitorCNJ - Petições Jurídicas com IA

Plataforma gratuita para advogados gerarem petições jurídicas usando Inteligência Artificial, com integração à API do CNJ e otimização de custos.

## 🎯 Recursos Principais

- **Multi-Provedor IA**: Groq (Llama 3.3 70B), Google Gemini Flash, SiliconFlow (Qwen3-8B)
- **Fallback Automático**: Roteia entre provedores em caso de falha ou limite atingido
- **Cache Inteligente**: Redis para respostas idênticas (~30% economia)
- **Otimização de Tokens**: Prompts jurídicos otimizados (~40% economia)
- **OCR Client-Side**: Tesseract.js no navegador (sem custo de servidor)
- **API CNJ**: Proxy seguro para DataJud
- **LGPD Compliant**: Logs apenas de metadados, sem conteúdo sensível

## 📁 Estrutura do Projeto

```
monitorcnj/
├── backend/           # API Node.js + TypeScript + Prisma
│   ├── src/
│   │   ├── config/    # Configurações (DB, IA, Rate Limit)
│   │   ├── middleware/# Auth, Rate Limit, Audit Log
│   │   ├── services/  # AIRouter, CacheManager, CNJ Proxy
│   │   ├── controllers/
│   │   └── routes/
│   └── prisma/
└── frontend/          # React + Vite + TailwindCSS
    └── src/
        ├── components/
        ├── hooks/
        └── utils/
```

## 🚀 Instalação Local ($0 Custo)

### Pré-requisitos
- Node.js 18+
- npm ou yarn

### 1. Backend

```bash
cd monitorcnj/backend

# Instalar dependências
npm install

# Copiar .env.example e configurar (opcional para teste local)
cp .env.example .env

# Gerar cliente Prisma
npx prisma generate

# Rodar em desenvolvimento
npm run dev
```

A API estará em: http://localhost:3001

### 2. Frontend

```bash
cd monitorcnj/frontend

# Instalar dependências
npm install

# Copiar .env.example
cp .env.example .env

# Rodar em desenvolvimento
npm run dev
```

O frontend estará em: http://localhost:5173

## 🔑 Configuração dos Serviços Gratuitos

### 1. Groq (IA Principal)
1. Acesse https://console.groq.com
2. Crie conta e gere API Key
3. Free tier: ~30 req/min, 14400 req/dia

### 2. Google Gemini (Fallback)
1. Acesse https://aistudio.google.com/apikey
2. Gere API Key
3. Free tier: 15 req/min, 1.5M tokens/min

### 3. SiliconFlow (Backup)
1. Acesse https://cloud.siliconflow.cn
2. Crie conta e gere API Key
3. Free tier: limites variados

### 4. Neon.tech (PostgreSQL)
1. Acesse https://neon.tech
2. Crie projeto gratuito
3. Copie connection string
4. Free tier: 0.5 GB storage

### 5. Upstash (Redis)
1. Acesse https://upstash.com
2. Crie database Redis
3. Copie URL e Token
4. Free tier: 10k comandos/dia

## 📊 Como o Fallback e Cache Economizam

### Fallback Automático
```
Groq (principal) → SiliconFlow → Gemini
     ↓                  ↓           ↓
  Falhou?         Falhou?     Última opção
  Tenta próximo   Tenta próximo
```

**Economia**: Evita perda de requisições quando um provider atinge limite

### Cache de Respostas
```
Prompt → Hash → Redis → HIT? → Retorna cache (0 tokens!)
                    ↓
                   MISS → Chama IA → Salva cache
```

**Economia**: ~30% das requisições evitadas para prompts repetidos

### Otimização de Prompts
```
Original: 1000 tokens
   ↓ (remove redundâncias jurídicas)
Otimizado: 600 tokens (-40%)
```

**Economia**: 40% menos tokens por requisição

## 🛡️ Segurança & LGPD

- JWT simples para autenticação
- Senhas com bcrypt (hash irreversível)
- IPs mascarados nos logs (últimos 4 dígitos)
- **NUNCA** armazena conteúdo de petições
- Logs apenas de metadados (endpoint, provider, tokens, sucesso)

## 📝 Endpoints da API

| Método | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| POST | `/api/v1/auth/register` | Registrar usuário | Não |
| POST | `/api/v1/auth/login` | Login | Não |
| GET | `/api/v1/profile/me` | Perfil | Sim |
| PUT | `/api/v1/profile/me` | Atualizar perfil | Sim |
| POST | `/api/v1/petition/generate` | Gerar petição | Sim |
| GET | `/api/v1/cnj/processes` | Buscar processos CNJ | Sim |
| GET | `/api/v1/health/full` | Health check completo | Não |

## 🧪 Testes

```bash
# Backend
cd backend
npm run test:free-tier  # Verifica configuração dos providers

# Frontend
cd frontend
npm run build  # Build de produção
```

## 📄 Licença

MIT - Uso livre para fins educacionais e comerciais.

---

**MonitorCNJ © 2024** - Desenvolvido com foco em custo zero e privacidade.
