import { list } from '../controllers/senderController';
import { Router } from 'express';
import * as emailController from '../controllers/emailController';
import * as authController from '../controllers/authController';
import * as slackController from '../controllers/slackController';
import { authMiddleware } from '../middleware/auth';

// Type workaround for express router
type RouteHandler = (req: any, res: any, next: any) => any;

const router = Router();
const wrap=(fn:RouteHandler):RouteHandler=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);

// Health check
router.get('/health', emailController.getHealth);

// Auth routes
router.get('/auth/google', authController.googleAuth);
router.get('/auth/google/callback', authController.googleCallback);
router.get('/auth/me', authMiddleware, wrap(authController.getMe as RouteHandler));
router.post('/auth/logout', wrap(authController.logout as RouteHandler));

// Email routes
router.post('/emails/schedule', authMiddleware, wrap(emailController.scheduleEmails as RouteHandler));
router.get('/emails/scheduled', authMiddleware, wrap(emailController.getScheduledEmails as RouteHandler));
router.get('/emails/sent', authMiddleware, wrap(emailController.getSentEmails as RouteHandler));
router.get('/emails/search', authMiddleware, wrap(emailController.searchEmails as RouteHandler));
router.get('/emails/:id', authMiddleware, wrap(emailController.getEmailById as RouteHandler));
router.get('/senders',authMiddleware,wrap(list as RouteHandler));
router.delete('/emails/:id', authMiddleware, wrap(emailController.deleteEmail as RouteHandler));

// Slack routes
router.get('/slack/connect', authMiddleware, wrap(slackController.connect as RouteHandler));
router.get('/slack/callback', authMiddleware, wrap(slackController.callback as RouteHandler));
router.get('/slack/status', authMiddleware, wrap(slackController.status as RouteHandler));
router.post('/slack/disconnect', authMiddleware, wrap(slackController.disconnect as RouteHandler));

export default router;