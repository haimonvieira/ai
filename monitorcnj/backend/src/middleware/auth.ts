// ===========================================
// Middleware de Autenticação JWT
// ===========================================
// Segurança básica para proteger endpoints
// Token válido por 7 dias (configurável)

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db';

// Interface do payload do JWT
export interface JWTPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

// Extensão do Request do Express com usuário autenticado
export interface AuthRequest extends Request {
  user?: JWTPayload;
}

// ===========================================
// VERIFICAÇÃO DE AUTENTICAÇÃO
// ===========================================
export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extrai token do header Authorization: Bearer <token>
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Token de autenticação não fornecido',
      });
      return;
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'fallback-secret';

    // Verifica e decodifica o token
    const decoded = jwt.verify(token, secret) as JWTPayload;

    // Valida se o usuário ainda existe no banco
    const userExists = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true },
    });

    if (!userExists) {
      res.status(401).json({
        success: false,
        error: 'Usuário não encontrado. Faça login novamente.',
      });
      return;
    }

    // Adiciona usuário ao request para uso nos controllers
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: 'Token inválido',
      });
      return;
    }

    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: 'Token expirado. Faça login novamente.',
      });
      return;
    }

    // Erro inesperado
    console.error('[Auth] Erro na autenticação:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno na autenticação',
    });
  }
}

// ===========================================
// GENERADOR DE TOKEN (usado no AuthController)
// ===========================================
export function generateToken(userId: string, email: string): string {
  const secret = process.env.JWT_SECRET || 'fallback-secret';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  return jwt.sign({ userId, email }, secret, { expiresIn });
}

// ===========================================
// MIDDLEWARE OPCIONAL (não bloqueia)
// ===========================================
// Para endpoints que funcionam com ou sem auth
export async function optionalAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const secret = process.env.JWT_SECRET || 'fallback-secret';
      const decoded = jwt.verify(token, secret) as JWTPayload;
      req.user = decoded;
    }
  } catch {
    // Ignora erros - auth é opcional
  }
  next();
}
