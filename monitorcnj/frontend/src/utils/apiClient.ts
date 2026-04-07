// ===========================================
// Cliente de API - MonitorCNJ Frontend
// ===========================================
// HTTP client com interceptors, retry e tratamento de erros

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

// Tipos
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: any;
}

export interface ApiError extends Error {
  status?: number;
  details?: any;
}

// ===========================================
// CLIENTE HTTP COM RETRY E BACKOFF
// ===========================================
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Recupera token do localStorage
  const token = localStorage.getItem('token');
  
  // Headers padrão
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Adiciona autenticação se tiver token
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Configuração de retry com backoff exponencial
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Extrai headers customizados para rate limit
      const remaining = response.headers.get('X-RateLimit-Remaining');
      const provider = response.headers.get('X-Provider-Used');
      const cached = response.headers.get('X-Cache-Hit');

      // Armazena info no sessionStorage para dashboard
      if (remaining) {
        sessionStorage.setItem('rateLimitRemaining', remaining);
      }
      if (provider) {
        sessionStorage.setItem('lastProvider', provider);
      }
      if (cached) {
        sessionStorage.setItem('lastCacheHit', cached);
      }

      // Parse da resposta
      const data = await response.json();

      if (!response.ok) {
        // Erro 429 - Rate limit
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After') || '60';
          throw Object.assign(new Error(`Rate limit atingido. Aguarde ${retryAfter}s`), {
            status: 429,
            retryAfter: parseInt(retryAfter),
          });
        }

        // Outros erros
        throw Object.assign(new Error(data.error || 'Erro na requisição'), {
          status: response.status,
          details: data.details,
        });
      }

      return data as ApiResponse<T>;
    } catch (error) {
      lastError = error as Error;

      // Verifica se é erro retryable
      const isRetryable = 
        (error as ApiError).status === 429 ||
        (error as ApiError).status === 503 ||
        (error as ApiError).status === 500;

      if (!isRetryable || attempt === maxRetries - 1) {
        break;
      }

      // Backoff exponencial: 1s, 2s, 4s
      const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
      console.log(`[API] Retry em ${delay}ms (tentativa ${attempt + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // Todos os retries falharam
  throw lastError || new Error('Erro desconhecido na requisição');
}

// ===========================================
// MÉTODOS HTTP
// ===========================================
export const api = {
  // GET
  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),

  // POST
  post: <T>(endpoint: string, body: any) =>
    request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // PUT
  put: <T>(endpoint: string, body: any) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  // DELETE
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};

// ===========================================
// ENDPOINTS ESPECÍFICOS
// ===========================================
export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ user: any; token: string }>('/auth/login', { email, password }),

  register: (data: any) =>
    api.post<{ user: any; token: string }>('/auth/register', data),

  logout: () => {
    localStorage.removeItem('token');
    sessionStorage.clear();
  },
};

export const profileApi = {
  get: () => api.get<any>('/profile/me'),
  update: (data: any) => api.put<any>('/profile/me', data),
  getUsage: () => api.get<any>('/profile/usage'),
};

export const petitionApi = {
  generate: (data: any) =>
    api.post<{ content: string; metadata: any }>('/petition/generate', data),

  estimateTokens: (text: string) =>
    api.post<{ original: any; optimized: any }>('/petition/estimate-tokens', { text }),
};

export const cnjApi = {
  searchProcesses: (params: any) => {
    const query = new URLSearchParams(params).toString();
    return api.get<any>(`/cnj/processes?${query}`);
  },

  searchJurisprudence: (keywords: string[], tribunal?: string) => {
    const params = new URLSearchParams({ keywords: keywords.join(',') });
    if (tribunal) params.set('tribunal', tribunal);
    return api.get<any>(`/cnj/jurisprudence?${params.toString()}`);
  },
};

// ===========================================
// HEALTH CHECK
// ===========================================
export const healthApi = {
  check: () => api.get<any>('/health'),
  fullCheck: () => api.get<any>('/health/full'),
};
