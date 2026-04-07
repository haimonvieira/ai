// ===========================================
// Proxy Seguro para API do CNJ (DataJud)
// ===========================================
// Repasse seguro de queries para a API pública do CNJ
// https://api-publica.datajud.cnj.jus.br

import { z } from 'zod';

// Schema de validação para queries
const CNJQuerySchema = z.object({
  classe: z.string().optional(),
  assunto: z.string().optional(),
  tribunal: z.string().optional(),
  numeroProcesso: z.string().optional(),
});

export type CNJQuery = z.infer<typeof CNJQuerySchema>;

// Base URL da API CNJ
const CNJ_BASE_URL = process.env.CNJ_API_BASE_URL || 
  'https://api-publica.datajud.cnj.jus.br/api-publica';

// ===========================================
// BUSCA PROCESSOS POR FILTROS
// ===========================================
export async function searchProcesses(query: CNJQuery): Promise<any> {
  try {
    // Valida query antes de enviar
    const validatedQuery = CNJQuerySchema.parse(query);

    // Constrói URL com params
    const url = new URL(`${CNJ_BASE_URL}/v2/processos`);
    
    if (validatedQuery.classe) {
      url.searchParams.set('classe', validatedQuery.classe);
    }
    
    if (validatedQuery.assunto) {
      url.searchParams.set('assunto', validatedQuery.assunto);
    }
    
    if (validatedQuery.tribunal) {
      url.searchParams.set('tribunal', validatedQuery.tribunal);
    }

    if (validatedQuery.numeroProcesso) {
      url.searchParams.set('numeroProcesso', validatedQuery.numeroProcesso);
    }

    // Timeout de 10s para não travar
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('CNJ: Limite de requisições atingido. Aguarde.');
      }
      
      throw new Error(`CNJ API retornou ${response.status}`);
    }

    const data = await response.json();
    
    return {
      success: true,
      data: data._embedded?.processos || [],
      total: data.page?.totalElements || 0,
    };
  } catch (error) {
    if ((error as any).name === 'AbortError') {
      throw new Error('CNJ: Timeout na requisição');
    }

    if (error instanceof z.ZodError) {
      throw new Error(`CNJ: Parâmetros inválidos - ${error.errors[0].message}`);
    }

    console.error('[CNJ] Erro:', error);
    throw new Error(`CNJ: ${(error as Error).message}`);
  }
}

// ===========================================
// BUSCA PROCESSO POR NÚMERO
// ===========================================
export async function getProcessByNumber(numeroProcesso: string): Promise<any> {
  try {
    // Valida formato básico (20 dígitos)
    const cleaned = numeroProcesso.replace(/\D/g, '');
    
    if (cleaned.length !== 20) {
      throw new Error('Número do processo deve ter 20 dígitos');
    }

    // Formata: NNNNNNN-DD.AAAA.T.ORG.OOOO
    const formatted = cleaned.replace(
      /^(\d{7})(\d{2})(\d{4})(\d{1})(\d{2})(\d{4})$/,
      '$1-$2.$3.$4.$5.$6'
    );

    const url = `${CNJ_BASE_URL}/v2/processos/${encodeURIComponent(formatted)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: false,
          error: 'Processo não encontrado',
        };
      }
      
      throw new Error(`CNJ API retornou ${response.status}`);
    }

    const data = await response.json();
    
    return {
      success: true,
      data,
    };
  } catch (error) {
    if ((error as any).name === 'AbortError') {
      throw new Error('CNJ: Timeout na requisição');
    }

    console.error('[CNJ] Erro ao buscar processo:', error);
    throw new Error(`CNJ: ${(error as Error).message}`);
  }
}

// ===========================================
// BUSCA JURISPRUDÊNCIA
// ===========================================
export async function searchJurisprudence(
  keywords: string[],
  tribunal?: string
): Promise<any> {
  try {
    const url = new URL(`${CNJ_BASE_URL}/v2/jurisprudencia`);
    
    url.searchParams.set('texto', keywords.join(' '));
    
    if (tribunal) {
      url.searchParams.set('tribunal', tribunal);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`CNJ API retornou ${response.status}`);
    }

    const data = await response.json();
    
    return {
      success: true,
      data: data._embedded?.decisoes || [],
      total: data.page?.totalElements || 0,
    };
  } catch (error) {
    if ((error as any).name === 'AbortError') {
      throw new Error('CNJ: Timeout na requisição');
    }

    console.error('[CNJ] Erro ao buscar jurisprudência:', error);
    throw new Error(`CNJ: ${(error as Error).message}`);
  }
}

// ===========================================
// HEALTH CHECK DA API CNJ
// ===========================================
export async function checkCNJHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${CNJ_BASE_URL}/v2`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    
    return response.ok;
  } catch {
    return false;
  }
}
