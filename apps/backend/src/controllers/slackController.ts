import { Request, Response } from 'express';
import passport from 'passport';
import prisma from '../config/prisma';
import { WebClient } from '@slack/web-api';

// Minimal Slack OAuth integration using passport-slash strategy
// Using a simplified approach to avoid type conflicts

interface SlackProfile {
  id: string;
  displayName: string;
  emails: { value: string }[];
}

// Create Slack strategy dynamically to avoid import issues
const SlackStrategy = require('passport-slack').Strategy;

passport.use(new SlackStrategy(
  {
    clientID: process.env.SLACK_CLIENT_ID!,
    clientSecret: process.env.SLACK_CLIENT_SECRET!,
    callbackURL: process.env.SLACK_REDIRECT_URI || 'http://localhost:3000/api/slack/callback',
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (accessToken: any, refreshToken: any, profile: any, done: any) => {
    try {
      const email = profile.emails?.[0]?.value || profile.email || profile.user?.email;
      const userFromDB = await prisma.user.findFirst({
        where: { email: email as string },
      });

      if (!userFromDB) {
        return done(null, false);
      }

      await prisma.slackToken.upsert({
        where: { userId: userFromDB.id },
        update: {
          accessToken,
          teamId: (profile as any).team?.id || (profile as any).user?.team?.id || 'default',
          connected: true,
        },
        create: {
          userId: userFromDB.id,
          accessToken,
          teamId: (profile as any).team?.id || (profile as any).user?.team?.id || 'default',
          connected: true,
        },
      });

      return done(null, userFromDB.id);
    } catch (error) {
      return done(error, false);
    }
  },
));

export const connect = passport.authenticate('slack');

export const callback: any = [
  passport.authenticate('slack', { session: false }),
  (req: Request, res: Response) => {
    res.redirect(process.env.FRONTEND_URL || 'http://localhost:3000' + '/settings?slack=connected');
  },
];

export const status = async (req: Request, res: Response): Promise<void> => {
  const userId = ((req as any).user as any)?.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = await prisma.slackToken.findUnique({
    where: { userId },
  });

  res.json({ connected: token?.connected || false });
};

export const disconnect = async (req: Request, res: Response): Promise<void> => {
  const userId = ((req as any).user as any)?.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  await prisma.slackToken.update({
    where: { userId },
    data: { connected: false },
  });

  res.json({ message: 'Slack disconnected' });
};