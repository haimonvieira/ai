// ===========================================
// Configuração dos Provedores de IA
// ===========================================
// Ordem de fallback: Groq → SiliconFlow → Gemini
// Todos em free tier - limites controlados no rate-limits.ts

export interface AIProvider {
  name: string;
  apiKey?: string;
  model: string;
  baseUrl?: string;
  maxTokensPerDay: number;
  maxTokensPerMinute: number;
  enabled: boolean;
  priority: number; // 1 = principal, 2 = fallback, 3 = backup
}

// ===========================================
// GROQ (Principal) - Llama 3.3 70B
// ===========================================
// Free tier: ~30 req/min, 14400 req/dia (varia)
// Melhor custo-benefício para texto jurídico
export const groqConfig: AIProvider = {
  name: 'groq',
  apiKey: process.env.GROQ_API_KEY,
  model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  baseUrl: 'https://api.groq.com/openai/v1',
  maxTokensPerDay: 100000, // Limite conservador
  maxTokensPerMinute: 6000,
  enabled: !!process.env.GROQ_API_KEY,
  priority: 1,
};

// ===========================================
// SILICONFLOW (Fallback 1) - Qwen3-8B
// ===========================================
// Free tier: limites variados
// Backup quando Groq falha ou atinge limite
export const siliconFlowConfig: AIProvider = {
  name: 'siliconflow',
  apiKey: process.env.SILICONFLOW_API_KEY,
  model: process.env.SILICONFLOW_MODEL || 'Qwen/Qwen2.5-7B-Instruct',
  baseUrl: 'https://api.siliconflow.cn/v1',
  maxTokensPerDay: 50000,
  maxTokensPerMinute: 3000,
  enabled: !!process.env.SILICONFLOW_API_KEY,
  priority: 2,
};

// ===========================================
// GOOGLE GEMINI (Fallback 2/Multimodal)
// ===========================================
// Free tier: 15 req/min, 1M tokens/min, 1500 req/dia
// Usado como último recurso ou para documentos com imagens
export const geminiConfig: AIProvider = {
  name: 'gemini',
  apiKey: process.env.GEMINI_API_KEY,
  model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
  baseUrl: undefined, // Usa SDK oficial do Google
  maxTokensPerDay: 500000,
  maxTokensPerMinute: 60000,
  enabled: !!process.env.GEMINI_API_KEY,
  priority: 3,
};

// ===========================================
// Lista ordenada por prioridade
// ===========================================
export const aiProviders: AIProvider[] = [groqConfig, siliconFlowConfig, geminiConfig]
  .filter(provider => provider.enabled)
  .sort((a, b) => a.priority - b.priority);

// Provider padrão (primeiro disponível)
export const defaultProvider = aiProviders[0];

// Health check dos providers
export function getAvailableProviders(): AIProvider[] {
  return aiProviders.filter(p => p.enabled && p.apiKey);
}

export function getProviderByName(name: string): AIProvider | undefined {
  return aiProviders.find(p => p.name === name);
}
