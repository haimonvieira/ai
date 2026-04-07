// ===========================================
// Configuração de Rate Limits
// ===========================================
// Controle rigoroso para não estourar free tiers dos provedores
// Limites por usuário + limites globais

export interface RateLimitConfig {
  windowMs: number;      // Janela de tempo em ms
  maxRequests: number;   // Máximo de requisições na janela
  message: string;
}

// ===========================================
// LIMITES GERAIS DA API
// ===========================================
export const globalRateLimit: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minuto
  maxRequests: 30,     // 30 req/min (seguro para todos free tiers)
  message: 'Muitas requisições. Aguarde alguns segundos.',
};

// ===========================================
// LIMITES POR PROVEDOR DE IA (por usuário/dia)
// ===========================================
// Baseado nos free tiers reais de cada serviço
export const providerRateLimits = {
  groq: {
    windowMs: 24 * 60 * 60 * 1000, // 24 horas
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS_GROQ || '100'),
    message: 'Limite diário do Groq atingido. Usando fallback...',
  },
  gemini: {
    windowMs: 24 * 60 * 60 * 1000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS_GEMINI || '100'),
    message: 'Limite diário do Gemini atingido.',
  },
  siliconflow: {
    windowMs: 24 * 60 * 60 * 1000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS_SILICONFLOW || '100'),
    message: 'Limite diário do SiliconFlow atingido.',
  },
};

// ===========================================
// LIMITES DE AUTENTICAÇÃO
// ===========================================
export const authRateLimit: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutos
  maxRequests: 10,          // 10 tentativas
  message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
};

// ===========================================
// CONFIGURAÇÕES ADICIONAIS
// ===========================================
export const cacheTTL = parseInt(process.env.CACHE_TTL_SECONDS || '7200'); // 2h
export const cacheEnabled = process.env.CACHE_ENABLED !== 'false';

// Headers customizados para o frontend controlar UI
export const rateLimitHeaders = {
  remaining: 'X-RateLimit-Remaining',
  limit: 'X-RateLimit-Limit',
  reset: 'X-RateLimit-Reset',
  provider: 'X-Provider-Used',
  cached: 'X-Cache-Hit',
  tokensEstimated: 'X-Tokens-Estimated',
};
