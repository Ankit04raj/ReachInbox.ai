import { Router } from 'express';
import * as emailController from '../controllers/emailController';
import * as authController from '../controllers/authController';
import * as slackController from '../controllers/slackController';
import { authMiddleware } from '../middleware/auth';

// Type workaround for express router
type RouteHandler = (req: any, res: any, next: any) => any;

const router = Router();

// Health check
router.get('/health', emailController.getHealth);

// Auth routes
router.get('/auth/google', authController.googleAuth);
router.get('/auth/google/callback', authController.googleCallback);
router.get('/auth/me', authMiddleware, authController.getMe as RouteHandler);
router.post('/auth/logout', authController.logout as RouteHandler);

// Email routes
router.post('/emails/schedule', authMiddleware, emailController.scheduleEmails as RouteHandler);
router.get('/emails/scheduled', authMiddleware, emailController.getScheduledEmails as RouteHandler);
router.get('/emails/sent', authMiddleware, emailController.getSentEmails as RouteHandler);
router.get('/emails/:id', authMiddleware, emailController.getEmailById as RouteHandler);
router.get('/emails/search', authMiddleware, emailController.searchEmails as RouteHandler);
router.delete('/emails/:id', authMiddleware, emailController.deleteEmail as RouteHandler);

// Slack routes
router.get('/slack/connect', slackController.connect);
router.get('/slack/callback', slackController.callback as RouteHandler);
router.get('/slack/status', authMiddleware, slackController.status as RouteHandler);
router.post('/slack/disconnect', authMiddleware, slackController.disconnect as RouteHandler);

export default router;