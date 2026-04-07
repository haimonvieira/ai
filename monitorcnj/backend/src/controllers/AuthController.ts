// ===========================================
// Controller de Autenticação
// ===========================================
// Registro e login de usuários com JWT
// Hash de senha com bcryptjs

import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../config/db';
import { generateToken } from '../middleware/auth';
import { AuthRequest } from '../middleware/auth';

// ===========================================
// SCHEMAS DE VALIDAÇÃO
// ===========================================
const registerSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  name: z.string().optional(),
  oabNumber: z.string().optional(),
  oabState: z.string().length(2, 'UF deve ter 2 caracteres').optional(),
});

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
});

// ===========================================
// REGISTRO DE USUÁRIO
// ===========================================
export async function register(req: Request, res: Response): Promise<void> {
  try {
    // Valida dados de entrada
    const data = registerSchema.parse(req.body);

    // Verifica se e-mail já existe
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true },
    });

    if (existingUser) {
      res.status(409).json({
        success: false,
        error: 'E-mail já cadastrado',
      });
      return;
    }

    // Hash da senha (custo 10 para balancear segurança/performance)
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Cria usuário no banco
    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
        oabNumber: data.oabNumber,
        oabState: data.oabState,
      },
      select: {
        id: true,
        email: true,
        name: true,
        oabNumber: true,
        oabState: true,
        createdAt: true,
      },
    });

    // Gera token JWT
    const token = generateToken(user.id, user.email);

    // Log de auditoria (manual, pois ainda não está autenticado)
    console.log(`[Auth] Novo usuário registrado: ${user.email}`);

    res.status(201).json({
      success: true,
      data: {
        user,
        token,
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

    console.error('[Auth] Erro no registro:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao registrar usuário',
    });
  }
}

// ===========================================
// LOGIN
// ===========================================
export async function login(req: Request, res: Response): Promise<void> {
  try {
    // Valida dados de entrada
    const { email, password } = loginSchema.parse(req.body);

    // Busca usuário
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        name: true,
        oabNumber: true,
        oabState: true,
        lastLoginAt: true,
      },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'E-mail ou senha inválidos',
      });
      return;
    }

    // Verifica senha
    const passwordValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordValid) {
      res.status(401).json({
        success: false,
        error: 'E-mail ou senha inválidos',
      });
      return;
    }

    // Atualiza último login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Gera token JWT
    const token = generateToken(user.id, user.email);

    // Remove passwordHash da resposta
    const { passwordHash, ...userData } = user;

    console.log(`[Auth] Login: ${user.email}`);

    res.json({
      success: true,
      data: {
        user: userData,
        token,
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

    console.error('[Auth] Erro no login:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao fazer login',
    });
  }
}

// ===========================================
// LOGOUT (opcional - client-side apenas)
// ===========================================
export async function logout(req: AuthRequest, res: Response): Promise<void> {
  // Logout é feito no client (remover token)
  // Aqui poderíamos invalidar token se usássemos blacklist
  res.json({
    success: true,
    message: 'Logout realizado com sucesso',
  });
}
