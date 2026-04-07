// ===========================================
// Roteador de IA com Fallback Automático
// ===========================================
// Gerencia múltiplos provedores (Groq, Gemini, SiliconFlow)
// Fallback automático em caso de falha ou limite atingido

import { AIProvider, aiProviders, getAvailableProviders } from '../../config/ai-providers';
import { estimateTokens } from './PromptOptimizer';
import { getCachedResponse, saveToCache, CachedResponse } from './CacheManager';

// Resultado da geração
export interface AIGenerationResult {
  content: string;
  provider: string;
  model: string;
  tokensUsed: number;
  cached: boolean;
  duration: number;
}

// Erro customizado para fallback
export class AIFallbackError extends Error {
  constructor(
    message: string,
    public readonly failedProvider: string,
    public readonly nextProvider?: string
  ) {
    super(message);
    this.name = 'AIFallbackError';
  }
}

// ===========================================
// INTEGRAÇÃO COM GROQ (OpenAI-compatible)
// ===========================================
async function callGroq(
  prompt: string,
  model: string,
  apiKey: string
): Promise<string> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'Você é um assistente jurídico especializado em direito brasileiro. Redija petições claras, fundamentadas e no formato padrão OAB.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.text().catch(() => 'Erro desconhecido');
    
    if (response.status === 429) {
      throw new AIFallbackError(`Groq: Limite de rate limit atingido`, 'groq');
    }
    
    throw new Error(`Groq (${response.status}): ${error}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '[Sem conteúdo gerado]';
}

// ===========================================
// INTEGRAÇÃO COM SILICONFLOW (OpenAI-compatible)
// ===========================================
async function callSiliconFlow(
  prompt: string,
  model: string,
  apiKey: string
): Promise<string> {
  const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'Você é um assistente jurídico especializado em direito brasileiro. Responda em português do Brasil.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.text().catch(() => 'Erro desconhecido');
    
    if (response.status === 429) {
      throw new AIFallbackError(`SiliconFlow: Limite atingido`, 'siliconflow');
    }
    
    throw new Error(`SiliconFlow (${response.status}): ${error}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '[Sem conteúdo gerado]';
}

// ===========================================
// INTEGRAÇÃO COM GOOGLE GEMINI
// ===========================================
async function callGemini(
  prompt: string,
  model: string,
  apiKey: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `Como assistente jurídico brasileiro, redija: ${prompt}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text().catch(() => 'Erro desconhecido');
    
    if (response.status === 429) {
      throw new AIFallbackError(`Gemini: Limite de requisições atingido`, 'gemini');
    }
    
    throw new Error(`Gemini (${response.status}): ${error}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '[Sem conteúdo gerado]';
}

// ===========================================
// CHAMA PROVEDOR ESPECÍFICO
// ===========================================
async function callProvider(
  provider: AIProvider,
  prompt: string
): Promise<string> {
  if (!provider.apiKey) {
    throw new Error(`${provider.name}: API key não configurada`);
  }

  switch (provider.name) {
    case 'groq':
      return callGroq(prompt, provider.model, provider.apiKey);
    
    case 'siliconflow':
      return callSiliconFlow(prompt, provider.model, provider.apiKey);
    
    case 'gemini':
      return callGemini(prompt, provider.model, provider.apiKey);
    
    default:
      throw new Error(`Provedor desconhecido: ${provider.name}`);
  }
}

// ===========================================
// ROTEADOR PRINCIPAL COM FALLBACK
// ===========================================
export async function generateWithFallback(
  prompt: string,
  preferences: {
    preferredProvider?: string;
    maxRetries?: number;
  } = {}
): Promise<AIGenerationResult> {
  const startTime = Date.now();
  const { preferredProvider, maxRetries = 3 } = preferences;

  // 1. Tenta cache primeiro (economiza tokens!)
  const cached = await getCachedResponse(prompt, preferences);
  if (cached) {
    return {
      content: cached.content,
      provider: cached.provider,
      model: cached.model,
      tokensUsed: cached.tokensUsed,
      cached: true,
      duration: Date.now() - startTime,
    };
  }

  // 2. Ordena providers por prioridade
  let providers = [...getAvailableProviders()];
  
  // Se tem preferredProvider, move para primeiro
  if (preferredProvider) {
    const preferredIndex = providers.findIndex(p => p.name === preferredProvider);
    if (preferredIndex > 0) {
      const [preferred] = providers.splice(preferredIndex, 1);
      providers.unshift(preferred);
    }
  }

  if (providers.length === 0) {
    throw new Error('Nenhum provedor de IA disponível. Configure as API keys.');
  }

  // 3. Tenta cada provider em sequência (fallback chain)
  let lastError: Error | null = null;
  let retries = 0;

  for (const provider of providers) {
    try {
      console.log(`[AIRouter] Tentando ${provider.name} (${provider.model})...`);
      
      const content = await callProvider(provider, prompt);
      const tokensUsed = estimateTokens(content);

      // Sucesso! Salva no cache
      const cacheData: CachedResponse = {
        content,
        provider: provider.name,
        model: provider.model,
        tokensUsed,
        timestamp: Date.now(),
      };

      await saveToCache(prompt, cacheData, preferences);

      return {
        content,
        provider: provider.name,
        model: provider.model,
        tokensUsed,
        cached: false,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      lastError = error as Error;
      retries++;

      console.warn(`[AIRouter] ${provider.name} falhou:`, error);

      // Verifica se é erro de fallback
      if (error instanceof AIFallbackError) {
        console.log(`[AIRouter] Fallback ativado para ${provider.name}`);
        continue; // Tenta próximo
      }

      // Erro crítico - não tenta mais
      if (retries >= maxRetries) {
        break;
      }
    }
  }

  // Todos falharam
  throw new Error(
    `Todos os provedores falharam após ${retries} tentativas. Último erro: ${lastError?.message}`
  );
}

// ===========================================
// HEALTH CHECK DOS PROVIDERS
// ===========================================
export async function checkProvidersHealth(): Promise<
  Array<{ name: string; available: boolean; error?: string }>
> {
  const results = [];

  for (const provider of aiProviders) {
    try {
      if (!provider.enabled || !provider.apiKey) {
        results.push({
          name: provider.name,
          available: false,
          error: 'Não configurado',
        });
        continue;
      }

      // Teste simples (sem gastar tokens reais)
      results.push({
        name: provider.name,
        available: true,
      });
    } catch (error) {
      results.push({
        name: provider.name,
        available: false,
        error: (error as Error).message,
      });
    }
  }

  return results;
}
