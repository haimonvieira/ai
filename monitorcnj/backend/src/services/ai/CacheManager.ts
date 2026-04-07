// ===========================================
// Gerenciador de Cache com Redis (Upstash)
// ===========================================
// Cache de respostas da IA para economizar tokens e requisições
// Free tier Upstash: 10k comandos/dia, 256MB

import Redis from 'ioredis';
import { createHash } from 'crypto';
import { cacheTTL, cacheEnabled } from '../config/rate-limits';

// Interface do item em cache
export interface CachedResponse {
  content: string;
  provider: string;
  model: string;
  tokensUsed: number;
  timestamp: number;
}

// Singleton do Redis
let redisClient: Redis | null = null;

// ===========================================
// INICIALIZAÇÃO DO REDIS
// ===========================================
export function initRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn('[Cache] Redis não configurado. Executando sem cache.');
    return null;
  }

  try {
    // Upstash Redis com configuração otimizada para free tier
    redisClient = new Redis(url, {
      password: token,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) return null; // Para após 3 tentativas
        return Math.min(times * 200, 2000);
      },
    });

    redisClient.on('error', (err) => {
      console.error('[Cache] Erro no Redis:', err.message);
    });

    redisClient.on('connect', () => {
      console.log('[Cache] Redis conectado com sucesso');
    });

    return redisClient;
  } catch (error) {
    console.error('[Cache] Falha ao inicializar Redis:', error);
    return null;
  }
}

// ===========================================
// GERA HASH DO PROMPT PARA CHAVE DO CACHE
// ===========================================
// Hash consistente para identificar prompts idênticos
function generatePromptHash(prompt: string, preferences: any): string {
  const keyData = JSON.stringify({ prompt, preferences });
  return createHash('sha256').update(keyData).digest('hex').slice(0, 16);
}

// ===========================================
// BUSCA NO CACHE
// ===========================================
export async function getCachedResponse(
  prompt: string,
  preferences: any = {}
): Promise<CachedResponse | null> {
  if (!cacheEnabled || !redisClient) {
    return null;
  }

  try {
    const hash = generatePromptHash(prompt, preferences);
    const cacheKey = `cache:petition:${hash}`;

    const cached = await redisClient.get(cacheKey);

    if (cached) {
      const parsed = JSON.parse(cached) as CachedResponse;
      
      // Verifica se ainda é válido (TTL)
      const age = Date.now() - parsed.timestamp;
      const maxAge = cacheTTL * 1000;

      if (age < maxAge) {
        console.log(`[Cache] HIT para prompt ${hash.slice(0, 8)}...`);
        return parsed;
      } else {
        // Expirou - remove
        await redisClient.del(cacheKey);
      }
    }

    console.log(`[Cache] MISS para prompt ${hash.slice(0, 8)}...`);
    return null;
  } catch (error) {
    console.error('[Cache] Erro ao buscar no cache:', error);
    return null; // Fail-safe: não quebra se cache falhar
  }
}

// ===========================================
// SALVA NO CACHE
// ===========================================
export async function saveToCache(
  prompt: string,
  response: CachedResponse,
  preferences: any = {}
): Promise<void> {
  if (!cacheEnabled || !redisClient) {
    return;
  }

  try {
    const hash = generatePromptHash(prompt, preferences);
    const cacheKey = `cache:petition:${hash}`;

    // Adiciona TTL automático
    const data = {
      ...response,
      timestamp: Date.now(),
    };

    await redisClient.setex(
      cacheKey,
      cacheTTL,
      JSON.stringify(data)
    );

    console.log(`[Cache] SAVE para prompt ${hash.slice(0, 8)}... (TTL: ${cacheTTL}s)`);
  } catch (error) {
    console.error('[Cache] Erro ao salvar no cache:', error);
    // Não falha se cache não funcionar
  }
}

// ===========================================
// INVALIDA CACHE ESPECÍFICO
// ===========================================
export async function invalidateCache(
  prompt: string,
  preferences: any = {}
): Promise<void> {
  if (!redisClient) return;

  try {
    const hash = generatePromptHash(prompt, preferences);
    const cacheKey = `cache:petition:${hash}`;
    await redisClient.del(cacheKey);
    console.log(`[Cache] INVALIDATE para prompt ${hash.slice(0, 8)}...`);
  } catch (error) {
    console.error('[Cache] Erro ao invalidar cache:', error);
  }
}

// ===========================================
// ESTATÍSTICAS DO CACHE (para dashboard)
// ===========================================
export async function getCacheStats(): Promise<{
  enabled: boolean;
  connected: boolean;
  ttl: number;
}> {
  return {
    enabled: cacheEnabled,
    connected: redisClient !== null && redisClient?.status === 'ready',
    ttl: cacheTTL,
  };
}

// ===========================================
// HEALTH CHECK
// ===========================================
export async function checkRedisHealth(): Promise<boolean> {
  if (!redisClient) return false;

  try {
    await redisClient.ping();
    return true;
  } catch {
    return false;
  }
}
