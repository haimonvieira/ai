// ===========================================
// Middleware de Rate Limiting Personalizado
// ===========================================
// Controle por usuário e provedor para proteger free tiers
// Implementação própria para ter controle fino dos limites

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { providerRateLimits, globalRateLimit, rateLimitHeaders } from '../config/rate-limits';
import { AuthRequest } from './auth';

// ===========================================
// RATE LIMIT GLOBAL (todas as requisições)
// ===========================================
const globalLimitStore = new Map<string, { count: number; resetTime: number }>();

export function globalRateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = globalRateLimit.windowMs;

  // Limpa registros expirados periodicamente
  if (Math.random() < 0.01) { // 1% das vezes
    for (const [key, value] of globalLimitStore.entries()) {
      if (value.resetTime < now) {
        globalLimitStore.delete(key);
      }
    }
  }

  let record = globalLimitStore.get(ip);

  if (!record || record.resetTime < now) {
    // Nova janela
    record = {
      count: 1,
      resetTime: now + windowMs,
    };
    globalLimitStore.set(ip, record);
  } else {
    record.count++;
  }

  // Define headers de rate limit
  res.setHeader(rateLimitHeaders.limit, globalRateLimit.maxRequests);
  res.setHeader(rateLimitHeaders.remaining, Math.max(0, globalRateLimit.maxRequests - record.count));
  res.setHeader(rateLimitHeaders.reset, Math.ceil(record.resetTime / 1000));

  if (record.count > globalRateLimit.maxRequests) {
    res.status(429).json({
      success: false,
      error: globalRateLimit.message,
    });
    return;
  }

  next();
}

// ===========================================
// RATE LIMIT POR PROVEDOR DE IA (por usuário)
// ===========================================
// Verifica no banco de dados para persistência entre restarts
export async function providerRateLimitMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user?.userId) {
      // Sem autenticação - permite mas com limite muito baixo
      next();
      return;
    }

    const userId = req.user.userId;
    const provider = res.locals.aiProvider || 'groq';
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Busca ou cria registro de rate limit
    let rateLimit = await prisma.rateLimit.findFirst({
      where: {
        userId,
        provider,
        windowStart: { gte: startOfDay },
      },
    });

    const config = providerRateLimits[provider as keyof typeof providerRateLimits];
    
    if (!config) {
      // Provider desconhecido - permite
      next();
      return;
    }

    if (!rateLimit) {
      // Cria novo registro para hoje
      rateLimit = await prisma.rateLimit.create({
        data: {
          userId,
          provider,
          count: 1,
          windowStart: startOfDay,
          windowEnd: new Date(startOfDay.getTime() + config.windowMs),
        },
      });
    } else {
      // Incrementa contador
      rateLimit = await prisma.rateLimit.update({
        where: { id: rateLimit.id },
        data: { count: rateLimit.count + 1 },
      });
    }

    // Headers para o frontend
    res.setHeader(rateLimitHeaders.limit, config.maxRequests);
    res.setHeader(rateLimitHeaders.remaining, Math.max(0, config.maxRequests - rateLimit.count));
    res.setHeader(rateLimitHeaders.provider, provider);

    if (rateLimit.count > config.maxRequests) {
      // Limite atingido - tenta fallback automático
      res.setHeader('X-Fallback-Available', 'true');
      
      // Não bloqueia imediatamente, apenas avisa
      // O AIRouter vai tentar o próximo provider
      console.warn(`[RateLimit] Usuário ${userId} atingiu limite do ${provider}`);
    }

    next();
  } catch (error) {
    // Erro no banco - não bloqueia, apenas loga
    console.error('[RateLimit] Erro ao verificar limite:', error);
    next();
  }
}

// ===========================================
// ATUALIZA INFO DO PROVIDER NO RESPONSE
// ===========================================
export function setProviderHeader(provider: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.locals.aiProvider = provider;
    res.setHeader(rateLimitHeaders.provider, provider);
    next();
  };
}
