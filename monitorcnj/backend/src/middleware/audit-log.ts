// ===========================================
// Middleware de Log de Auditoria (LGPD)
// ===========================================
// Registra metadados das requisições SEM conteúdo sensível
// Essencial para compliance e debugging

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AuthRequest } from './auth';

// Interface do log de auditoria
interface AuditLogData {
  userId: string;
  endpoint: string;
  method: string;
  provider?: string;
  success: boolean;
  statusCode?: number;
  tokensUsed?: number;
  cached?: boolean;
  ipAddress?: string;
  userAgent?: string;
}

// ===========================================
// CRIA LOG DE AUDITORIA ASSÍNCRONO
// ===========================================
// Não bloqueia a requisição - fire and forget
export function auditLogMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  // Captura o tempo de início para calcular duração
  const startTime = Date.now();

  // Sobrescreve o método json para capturar resposta
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    // Agenda criação do log após envio da resposta
    setImmediate(() => {
      createAuditLog(req, res, body).catch((err) => {
        console.error('[AuditLog] Erro ao criar log:', err);
      });
    });
    return originalJson(body);
  };

  next();
}

// ===========================================
// CRIA REGISTRO NO BANCO DE DADOS
// ===========================================
async function createAuditLog(
  req: AuthRequest,
  res: Response,
  responseBody: any
): Promise<void> {
  try {
    // Extrai dados da requisição
    const userId = req.user?.userId || 'anonymous';
    const endpoint = req.path;
    const method = req.method;
    const provider = res.getHeader('X-Provider-Used') as string | undefined;
    const cached = (res.getHeader('X-Cache-Hit') as string) === 'true';
    const tokensEstimated = parseInt(
      (res.getHeader('X-Tokens-Estimated') as string) || '0'
    );
    
    // Mascara IP (LGPD - não armazenar IP completo)
    const fullIp = req.ip || req.socket.remoteAddress || '';
    const maskedIp = maskIP(fullIp);

    // Determina sucesso baseado no status code
    const statusCode = res.statusCode;
    const success = statusCode >= 200 && statusCode < 400;

    // Dados do log
    const logData: AuditLogData = {
      userId,
      endpoint,
      method,
      provider,
      success,
      statusCode,
      tokensUsed: tokensEstimated > 0 ? tokensEstimated : undefined,
      cached,
      ipAddress: maskedIp,
      userAgent: req.headers['user-agent']?.slice(0, 200), // Limita tamanho
    };

    // Cria log no banco (não crítico - ignora erros)
    await prisma.auditLog.create({
      data: logData,
    }).catch((err) => {
      // Silencioso - não pode falhar por causa de logs
      if (process.env.NODE_ENV === 'development') {
        console.warn('[AuditLog] Falha ao salvar log:', err.message);
      }
    });

    // Log em console para desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      const duration = Date.now() - ((req as any)._startTime || Date.now());
      console.log(
        `[Audit] ${method} ${endpoint} - ${statusCode} - ${provider || 'N/A'} - ${duration}ms`
      );
    }
  } catch (error) {
    // Nunca falha por causa de logs
    console.error('[AuditLog] Erro crítico:', error);
  }
}

// ===========================================
// UTILITÁRIOS
// ===========================================

// Mascara IP para privacidade (LGPD)
function maskIP(ip: string): string {
  if (!ip) return 'unknown';
  
  // IPv4: mantém apenas últimos 2 octetos
  const ipv4Match = ip.match(/(\d+\.\d+)\.(\d+\.\d+)/);
  if (ipv4Match) {
    return `***.${ipv4Match[2]}`;
  }
  
  // IPv6: simplifica drasticamente
  if (ip.includes(':')) {
    return 'IPv6-masked';
  }
  
  return 'masked';
}

// ===========================================
// LOG MANUAL (para casos específicos)
// ===========================================
export async function manualAuditLog(data: AuditLogData): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        ...data,
        ipAddress: data.ipAddress ? maskIP(data.ipAddress) : undefined,
      },
    });
  } catch (error) {
    console.error('[AuditLog] Erro ao criar log manual:', error);
  }
}
