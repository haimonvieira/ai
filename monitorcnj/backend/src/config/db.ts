// ===========================================
// Configuração do Banco de Dados (Prisma)
// ===========================================
// Neon.tech PostgreSQL - Free Tier (0.5GB)
// Conexão com pool para otimizar recursos gratuitos

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Singleton do Prisma para evitar múltiplas conexões em hot-reload
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] 
    : ['error'],
  
  // Otimização para serverless/free tier
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Timeout de conexão reduzido para free tier
prisma.$connect().catch((err) => {
  console.error('[DB] Erro ao conectar no banco:', err.message);
  console.warn('[DB] Executando em modo limitado sem banco de dados');
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Helper para fechar conexão gracefulmente
export async function disconnectDB() {
  await prisma.$disconnect();
}

// Health check do banco
export async function checkDBHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
