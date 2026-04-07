// ===========================================
// Controller de Geração de Petições
// ===========================================
// Endpoint principal que usa AIRouter com fallback
// Otimiza prompts e gerencia cache

import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import { generateWithFallback } from '../services/ai/AIRouter';
import { optimizeLegalPrompt, validatePrompt, estimateTokens } from '../services/ai/PromptOptimizer';
import { searchProcesses, searchJurisprudence } from '../services/cnj/DataJudProxy';

// ===========================================
// SCHEMA DE GERAÇÃO DE PETIÇÃO
// ===========================================
const petitionSchema = z.object({
  prompt: z.string().min(20, 'Descreva melhor a petição desejada'),
  type: z.enum(['inicial', 'contestacao', 'recurso', 'parecer', 'outros']),
  court: z.string().optional(),
  parties: z.string().optional(),
  facts: z.string().optional(),
  legalBasis: z.string().optional(),
  request: z.string().optional(),
  provider: z.enum(['groq', 'gemini', 'siliconflow']).optional(),
  useCache: z.boolean().default(true),
});

// ===========================================
// GERAR PETIÇÃO COM IA
// ===========================================
export async function generatePetition(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const userId = req.user!.userId;
    
    // Valida dados de entrada
    const data = petitionSchema.parse(req.body);

    // Constrói prompt estruturado se usar template
    let fullPrompt = data.prompt;
    
    if (data.type && data.facts) {
      // Template jurídico otimizado
      fullPrompt = `
Redija uma petição ${data.type.toUpperCase()} com a seguinte estrutura:

${data.court ? `TRIBUNAL: ${data.court}` : ''}
${data.parties ? `PARTES: ${data.parties}` : ''}

FATOS:
${data.facts}

${data.legalBasis ? `FUNDAMENTAÇÃO JURÍDICA:\n${data.legalBasis}` : ''}

${data.request ? `PEDIDOS:\n${data.request}` : ''}

Use linguagem jurídica formal brasileira, cite artigos de lei relevantes e formate no padrão OAB.`.trim();
    }

    // Valida prompt antes de processar
    const validation = validatePrompt(fullPrompt);
    
    if (!validation.valid) {
      res.status(400).json({
        success: false,
        error: 'Prompt inválido',
        details: validation.errors,
      });
      return;
    }

    // Otimiza prompt para economizar tokens (~40% economia)
    const optimized = optimizeLegalPrompt(fullPrompt, {
      maxLength: 8000,
      removeRedundancies: true,
      compressFormatting: true,
    });

    console.log(`[Petition] Prompt otimizado: ${optimized.tokensOriginal} → ${optimized.tokensOptimized} tokens (${optimized.reductionPercent}% redução)`);

    // Headers de resposta
    res.setHeader('X-Tokens-Estimated', optimized.tokensOptimized.toString());
    res.setHeader('X-Tokens-Original', optimized.tokensOriginal.toString());

    // Gera com fallback automático entre providers
    const result = await generateWithFallback(optimized.optimized, {
      preferredProvider: data.provider,
      maxRetries: 3,
    });

    // Headers adicionais
    res.setHeader('X-Provider-Used', result.provider);
    res.setHeader('X-Model-Used', result.model);
    res.setHeader('X-Cache-Hit', result.cached.toString());
    res.setHeader('X-Generation-Duration', result.duration.toString());

    console.log(
      `[Petition] Gerado com ${result.provider} (${result.model}) - ` +
      `${result.tokensUsed} tokens - ${result.cached ? 'CACHE' : 'NOVO'} - ${result.duration}ms`
    );

    res.json({
      success: true,
      data: {
        content: result.content,
        metadata: {
          provider: result.provider,
          model: result.model,
          tokensUsed: result.tokensUsed,
          tokensEstimated: optimized.tokensOptimized,
          cached: result.cached,
          duration: result.duration,
          optimization: {
            originalTokens: optimized.tokensOriginal,
            optimizedTokens: optimized.tokensOptimized,
            reductionPercent: optimized.reductionPercent,
          },
        },
      },
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

    console.error('[Petition] Erro ao gerar petição:', error);

    // Verifica se é erro de todos os providers falharem
    if ((error as Error).message.includes('Todos os provedores falharam')) {
      res.status(503).json({
        success: false,
        error: 'Serviço de IA temporariamente indisponível. Tente novamente em alguns minutos.',
        retryAfter: 60,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Erro ao gerar petição',
      details: (error as Error).message,
    });
  }
}

// ===========================================
// ESTIMAR TOKENS (endpoint utilitário)
// ===========================================
export async function estimateTokensEndpoint(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { text } = req.body;

    if (!text) {
      res.status(400).json({
        success: false,
        error: 'Texto não fornecido',
      });
      return;
    }

    const tokens = estimateTokens(text);
    const optimized = optimizeLegalPrompt(text);

    res.json({
      success: true,
      data: {
        original: {
          characters: text.length,
          tokens: tokens,
        },
        optimized: {
          characters: optimized.optimized.length,
          tokens: optimized.tokensOptimized,
          reduction: optimized.reductionPercent,
        },
      },
    });
  } catch (error) {
    console.error('[Petition] Erro ao estimar tokens:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao estimar tokens',
    });
  }
}

// ===========================================
// BUSCAR PROCESSOS NO CNJ
// ===========================================
export async function searchCNJProcesses(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { classe, assunto, tribunal, numeroProcesso } = req.query;

    const result = await searchProcesses({
      classe: classe as string,
      assunto: assunto as string,
      tribunal: tribunal as string,
      numeroProcesso: numeroProcesso as string,
    });

    res.json(result);
  } catch (error) {
    console.error('[Petition] Erro ao buscar processos CNJ:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar processos',
      details: (error as Error).message,
    });
  }
}

// ===========================================
// BUSCAR JURISPRUDÊNCIA NO CNJ
// ===========================================
export async function searchCNJJurisprudence(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { keywords, tribunal } = req.query;

    if (!keywords) {
      res.status(400).json({
        success: false,
        error: 'Palavras-chave obrigatórias',
      });
      return;
    }

    const result = await searchJurisprudence(
      (keywords as string).split(','),
      tribunal as string
    );

    res.json(result);
  } catch (error) {
    console.error('[Petition] Erro ao buscar jurisprudência:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar jurisprudência',
      details: (error as Error).message,
    });
  }
}
