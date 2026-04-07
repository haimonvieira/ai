// ===========================================
// Controller de Perfil do Usuário
// ===========================================
// Gerencia dados do usuário e preferências

import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { AuthRequest } from '../middleware/auth';

// ===========================================
// SCHEMA DE PREFERÊNCIAS
// ===========================================
const preferencesSchema = z.object({
  defaultProvider: z.enum(['groq', 'gemini', 'siliconflow']).optional(),
  templateStyle: z.enum(['formal', 'direto', 'detalhado']).optional(),
  maxTokens: z.number().min(500).max(4000).optional(),
  includeCitations: z.boolean().optional(),
});

// ===========================================
// OBTER PERFIL ATUAL
// ===========================================
export async function getProfile(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        oabNumber: true,
        oabState: true,
        createdAt: true,
        lastLoginAt: true,
        preferences: true,
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'Usuário não encontrado',
      });
      return;
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('[Profile] Erro ao buscar perfil:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar perfil',
    });
  }
}

// ===========================================
// ATUALIZAR PREFERÊNCIAS
// ===========================================
export async function updatePreferences(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const data = preferencesSchema.parse(req.body);

    // Atualiza ou cria preferências
    const preferences = await prisma.userPreferences.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        ...data,
      },
    });

    res.json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
      return;
    }

    console.error('[Profile] Erro ao atualizar preferências:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao atualizar preferências',
    });
  }
}

// ===========================================
// ATUALIZAR DADOS CADASTRAIS
// ===========================================
export async function updateProfile(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { name, oabNumber, oabState } = req.body;

    // Validações simples
    if (oabState && oabState.length !== 2) {
      res.status(400).json({
        success: false,
        error: 'UF deve ter 2 caracteres',
      });
      return;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name: name || undefined,
        oabNumber: oabNumber || undefined,
        oabState: oabState || undefined,
      },
      select: {
        id: true,
        email: true,
        name: true,
        oabNumber: true,
        oabState: true,
      },
    });

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('[Profile] Erro ao atualizar perfil:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao atualizar perfil',
    });
  }
}

// ===========================================
// OBTER ESTATÍSTICAS DE USO
// ===========================================
export async function getUsageStats(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Busca rate limits do dia
    const rateLimits = await prisma.rateLimit.findMany({
      where: {
        userId,
        windowStart: { gte: today },
      },
      select: {
        provider: true,
        count: true,
      },
    });

    // Converte para formato amigável
    const usage = {
      date: today.toISOString(),
      providers: {} as Record<string, { used: number; limit: number }>,
    };

    const limits = {
      groq: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS_GROQ || '100'),
      gemini: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS_GEMINI || '100'),
      siliconflow: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS_SILICONFLOW || '100'),
    };

    for (const [provider, limit] of Object.entries(limits)) {
      const found = rateLimits.find(r => r.provider === provider);
      usage.providers[provider] = {
        used: found?.count || 0,
        limit,
      };
    }

    res.json({
      success: true,
      data: usage,
    });
  } catch (error) {
    console.error('[Profile] Erro ao buscar estatísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar estatísticas de uso',
    });
  }
}
