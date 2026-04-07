// ===========================================
// Servidor Principal - MonitorCNJ Backend
// ===========================================
// Express + TypeScript + Prisma + CORS + Helmet
// Configuração otimizada para free tier

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { disconnectDB, checkDBHealth } from './config/db';
import { initRedis, checkRedisHealth } from './services/ai/CacheManager';
import { checkProvidersHealth } from './services/ai/AIRouter';
import { checkCNJHealth } from './services/cnj/DataJudProxy';
import apiV1 from './routes/api.v1';

// Carrega variáveis de ambiente
dotenv.config();

// ===========================================
// CONFIGURAÇÃO DO SERVIDOR
// ===========================================
const app = express();
const PORT = parseInt(process.env.PORT || '3001');
const NODE_ENV = process.env.NODE_ENV || 'development';

// ===========================================
// MIDDLEWARES GLOBAIS
// ===========================================

// Security headers (Helmet)
app.use(helmet({
  contentSecurityPolicy: false, // Desativado para desenvolvimento
  crossOriginEmbedderPolicy: false,
}));

// CORS configurado
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  exposedHeaders: [
    'X-RateLimit-Remaining',
    'X-RateLimit-Limit',
    'X-RateLimit-Reset',
    'X-Provider-Used',
    'X-Cache-Hit',
    'X-Tokens-Estimated',
  ],
}));

// Body parser com limite para economizar memória
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Trust proxy para rate limiting correto atrás de reverse proxy
if (NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// ===========================================
// ROTAS
// ===========================================
app.use('/api/v1', apiV1);

// Rota raiz
app.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'MonitorCNJ API',
      version: '1.0.0',
      description: 'Plataforma de petições jurídicas com IA',
      endpoints: {
        health: '/api/v1/health',
        auth: '/api/v1/auth/*',
        profile: '/api/v1/profile/*',
        petition: '/api/v1/petition/*',
        cnj: '/api/v1/cnj/*',
      },
    },
  });
});

// ===========================================
// HEALTH CHECK COMPLETO
// ===========================================
app.get('/health/full', async (req, res) => {
  try {
    const [dbHealthy, redisHealthy, providers, cnjHealthy] = await Promise.all([
      checkDBHealth(),
      checkRedisHealth(),
      checkProvidersHealth(),
      checkCNJHealth(),
    ]);

    const allHealthy = dbHealthy && redisHealthy && cnjHealthy;

    res.status(allHealthy ? 200 : 207).json({
      success: allHealthy,
      data: {
        database: dbHealthy ? 'ok' : 'degraded',
        cache: redisHealthy ? 'ok' : 'disabled',
        cnj: cnjHealthy ? 'ok' : 'degraded',
        aiProviders: providers,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Health check falhou',
      details: (error as Error).message,
    });
  }
});

// ===========================================
// TRATAMENTO DE ERROS GLOBAL
// ===========================================
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Server] Erro não tratado:', err);

  // Não expõe detalhes do erro em produção
  res.status(err.status || 500).json({
    success: false,
    error: NODE_ENV === 'production' 
      ? 'Erro interno do servidor' 
      : err.message,
  });
});

// ===========================================
// INICIALIZAÇÃO
// ===========================================
async function startServer() {
  try {
    // Inicializa Redis (cache)
    initRedis();

    // Inicia servidor
    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════════╗
║          MONITORCNJ API - Backend                  ║
╠════════════════════════════════════════════════════╣
║  Ambiente: ${NODE_ENV.padEnd(42)}║
║  Porta: ${PORT.toString().padEnd(46)}║
║  URL: http://localhost:${PORT.toString().padEnd(32)}║
║  Docs: http://localhost:${PORT.toString().padEnd(32)}/api/v1/health║
╚════════════════════════════════════════════════════╝

Provedores de IA configurados:
  - Groq (Llama 3.3 70B): ${process.env.GROQ_API_KEY ? '✓' : '✗'}
  - Gemini Flash: ${process.env.GEMINI_API_KEY ? '✓' : '✗'}
  - SiliconFlow: ${process.env.SILICONFLOW_API_KEY ? '✓' : '✗'}

Cache Redis: ${process.env.UPSTASH_REDIS_REST_URL ? '✓' : '✗ (desativado)'}
Banco PostgreSQL: ${process.env.DATABASE_URL ? '✓' : '✗ (modo limitado)'}
      `);
    });
  } catch (error) {
    console.error('[Server] Erro ao iniciar:', error);
    process.exit(1);
  }
}

// ===========================================
// SHUTDOWN GRACEFUL
// ===========================================
process.on('SIGINT', async () => {
  console.log('\n[Server] Fechando servidor...');
  await disconnectDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n[Server] Terminando...');
  await disconnectDB();
  process.exit(0);
});

// Inicia
startServer();

export default app;
