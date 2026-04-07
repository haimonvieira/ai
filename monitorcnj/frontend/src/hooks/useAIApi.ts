// ===========================================
// Hook useAIApi - Geração de Petições com IA
// ===========================================
// Gerencia estado, loading, retry e tratamento de erros

import { useState, useCallback } from 'react';
import { petitionApi } from '../utils/apiClient';

// Tipos
export interface GenerationRequest {
  prompt: string;
  type: 'inicial' | 'contestacao' | 'recurso' | 'parecer' | 'outros';
  court?: string;
  parties?: string;
  facts?: string;
  legalBasis?: string;
  request?: string;
  provider?: 'groq' | 'gemini' | 'siliconflow';
}

export interface GenerationResult {
  content: string;
  metadata: {
    provider: string;
    model: string;
    tokensUsed: number;
    tokensEstimated: number;
    cached: boolean;
    duration: number;
    optimization: {
      originalTokens: number;
      optimizedTokens: number;
      reductionPercent: number;
    };
  };
}

export interface UseAIApiReturn {
  loading: boolean;
  error: string | null;
  result: GenerationResult | null;
  generatePetition: (request: GenerationRequest) => Promise<void>;
  reset: () => void;
}

// ===========================================
// HOOK PRINCIPAL
// ===========================================
export function useAIApi(): UseAIApiReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);

  // Gera petição com retry automático
  const generatePetition = useCallback(async (request: GenerationRequest) => {
    setLoading(true);
    setError(null);

    try {
      console.log('[useAIApi] Gerando petição...', request);

      const response = await petitionApi.generate(request);

      if (response.success && response.data) {
        setResult(response.data);
        console.log('[useAIApi] Petição gerada com sucesso!', {
          provider: response.data.metadata.provider,
          tokens: response.data.metadata.tokensUsed,
          cached: response.data.metadata.cached,
        });
      } else {
        throw new Error(response.error || 'Falha ao gerar petição');
      }
    } catch (err) {
      const errorMessage = (err as Error).message;
      setError(errorMessage);
      setResult(null);
      
      console.error('[useAIApi] Erro:', err);

      // Mensagens amigáveis por tipo de erro
      if ((err as any).status === 503) {
        setError('Serviço de IA temporariamente indisponível. Tente novamente em alguns minutos.');
      } else if ((err as any).status === 429) {
        setError('Limite de requisições atingido. Aguarde alguns instantes.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Reseta estado
  const reset = useCallback(() => {
    setError(null);
    setResult(null);
    setLoading(false);
  }, []);

  return {
    loading,
    error,
    result,
    generatePetition,
    reset,
  };
}

// ===========================================
// HOOK DE ESTIMATIVA DE TOKENS
// ===========================================
export function useTokenEstimate() {
  const [tokens, setTokens] = useState<{
    original: number;
    optimized: number;
    reduction: number;
  } | null>(null);

  const estimate = useCallback(async (text: string) => {
    if (!text.trim()) {
      setTokens(null);
      return;
    }

    try {
      const response = await petitionApi.estimateTokens(text);
      
      if (response.success && response.data) {
        setTokens({
          original: response.data.original.tokens,
          optimized: response.data.optimized.tokens,
          reduction: response.data.optimized.reduction,
        });
      }
    } catch (error) {
      console.error('[useTokenEstimate] Erro:', error);
    }
  }, []);

  return { tokens, estimate };
}
