// ===========================================
// Rotas da API v1
// ===========================================
// Define todos os endpoints públicos e protegidos

import { Router } from 'express';
import * as AuthController from '../controllers/AuthController';
import * as ProfileController from '../controllers/ProfileController';
import * as PetitionController from '../controllers/PetitionController';
import { authenticate } from '../middleware/auth';
import { globalRateLimitMiddleware, providerRateLimitMiddleware } from '../middleware/rate-limit';
import { auditLogMiddleware } from '../middleware/audit-log';

const router = Router();

// ===========================================
// MIDDLEWARE GLOBAL
// ===========================================
// Aplica rate limit e auditoria em todas as rotas
router.use(globalRateLimitMiddleware);
router.use(auditLogMiddleware);

// ===========================================
// ROTAS PÚBLICAS (sem autenticação)
// ===========================================

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  });
});

// Autenticação
router.post('/auth/register', AuthController.register);
router.post('/auth/login', AuthController.login);

// ===========================================
// ROTAS PROTEGIDAS (requer autenticação)
// ===========================================
router.use(authenticate);

// Perfil do usuário
router.get('/profile/me', ProfileController.getProfile);
router.put('/profile/me', ProfileController.updateProfile);
router.put('/profile/preferences', ProfileController.updatePreferences);
router.get('/profile/usage', ProfileController.getUsageStats);

// Geração de petições
router.post('/petition/generate', providerRateLimitMiddleware, PetitionController.generatePetition);
router.post('/petition/estimate-tokens', PetitionController.estimateTokensEndpoint);

// Consulta CNJ
router.get('/cnj/processes', PetitionController.searchCNJProcesses);
router.get('/cnj/jurisprudence', PetitionController.searchCNJJurisprudence);

// ===========================================
// ROTA PADRÃO (404)
// ===========================================
router.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint não encontrado',
    path: req.path,
  });
});

export default router;
