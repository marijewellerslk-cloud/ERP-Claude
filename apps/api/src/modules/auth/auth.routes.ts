import { Router } from 'express';
import { authController } from './auth.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();

// Public routes
router.post('/register', (req, res) => authController.register(req, res));
router.post('/login', (req, res) => authController.login(req, res));
router.post('/refresh', (req, res) => authController.refreshToken(req, res));
router.post('/logout', (req, res) => authController.logout(req, res));

// Protected routes
router.get('/me', authenticate, (req, res) => authController.me(req, res));
router.get('/roles', authenticate, (req, res) => authController.getRoles(req, res));
router.get('/users', authenticate, (req, res) => authController.getUsers(req, res));

// User management routes
router.get('/users/with-roles', authenticate, (req, res) => authController.getUsersWithRoles(req, res));
router.post('/users/create', authenticate, (req, res) => authController.createUser(req, res));
router.post('/users/:userId/reset-password', authenticate, (req, res) => authController.resetPassword(req, res));
router.put('/users/:userId/role', authenticate, (req, res) => authController.updateUserRole(req, res));
router.put('/users/:userId/toggle-active', authenticate, (req, res) => authController.toggleUserActive(req, res));

// Security routes
router.get('/history', authenticate, (req, res) => authController.getLoginHistory(req, res));
router.get('/sessions', authenticate, (req, res) => authController.getActiveSessions(req, res));
router.delete('/sessions/:sessionId', authenticate, (req, res) => authController.revokeSession(req, res));

export default router;
