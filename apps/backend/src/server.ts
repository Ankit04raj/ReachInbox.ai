import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

import prisma from './config/prisma';
import router from './routes';
import emailWorker from './workers/emailWorker';
import { ensureIndexExists } from './config/elasticsearch';
import { setupBullBoard } from './integrations/bullBoard';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(passport.initialize());

// Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  callbackURL: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/api/auth/google/callback',
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const existingUser = await prisma.user.findUnique({
      where: { googleId: profile.id },
    });

    if (existingUser) {
      return done(null as any, existingUser);
    }

    const newUser = await prisma.user.create({
      data: {
        googleId: profile.id,
        name: profile.displayName,
        email: (profile.emails && profile.emails[0] && profile.emails[0].value) || '',
        avatar: (profile.photos && profile.photos[0] && profile.photos[0].value) || '',
      },
    });

    return done(null as any, newUser);
  } catch (error) {
    return done(error as Error, null as any);
  }
}));

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  const user = await prisma.user.findUnique({ where: { id } });
  done(null, user);
});

// Routes
app.use('/api', router);

// Bull Board
const { router: bullBoardRouter } = setupBullBoard();
app.use('/admin/queues', bullBoardRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  // Ensure Elasticsearch index exists
  await ensureIndexExists();

  // Create default sender for demo
  const defaultSender = await prisma.sender.findFirst({
    where: { email: 'noreply@reachinbox.com' },
  });

  if (!defaultSender) {
    await prisma.sender.create({
      data: {
        userId: 'demo-user',
        email: 'noreply@reachinbox.com',
        hourlyLimit: parseInt(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || '100'),
        minimumDelay: parseInt(process.env.MIN_EMAIL_DELAY_MS || '2000'),
      },
    });
  }

  console.log('Worker initialized');
});

export default app;