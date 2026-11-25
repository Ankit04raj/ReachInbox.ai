import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma';
import emailQueue from '../queues/emailQueue';
import { checkHourlyCapacity, reserveSendSlot, calculateDelayForNextSlot } from '../services/rateLimitService';
import { indexEmail } from '../services/slackService';
import { ensureIndexExists } from '../config/elasticsearch';
import esClient from '../config/elasticsearch';

const scheduleSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
  recipients: z.array(z.string().email()),
  senderId: z.string(),
  startTime: z.string().datetime(),
  delayBetweenEmails: z.number().min(1000),
  hourlyLimit: z.number().min(1),
});

export const scheduleEmails = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const parsed = scheduleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
    }

    const { subject, body, recipients, senderId, startTime, delayBetweenEmails, hourlyLimit } = parsed.data;

    const sender = await prisma.sender.findUnique({
      where: { id: senderId, userId },
    });

    if (!sender) {
      return res.status(404).json({ error: 'Sender not found' });
    }

    const startTimeDate = new Date(startTime);
    const now = new Date();

    const scheduledEmails: any[] = [];

    for (let i = 0; i < recipients.length; i++) {
      const delay = i * delayBetweenEmails;
      const scheduledAt = new Date(startTimeDate.getTime() + delay);

      const email = await prisma.email.create({
        data: {
          userId,
          senderId,
          recipient: recipients[i],
          subject,
          body,
          scheduledAt,
          status: 'SCHEDULED',
        },
      });

      scheduledEmails.push(email);

      const jobDelay = Math.max(0, scheduledAt.getTime() - now.getTime());

      await emailQueue.add(
        `send-email-${email.id}`,
        { emailId: email.id, userId, senderId },
        {
          delay: jobDelay,
          jobId: `send-email-${email.id}`,
        },
      );
    }

    await ensureIndexExists();
    for (const email of scheduledEmails) {
      await indexEmail(email);
    }

    return res.status(201).json({
      message: 'Emails scheduled successfully',
      campaignId: `campaign-${userId}-${Date.now()}`,
      scheduledCount: recipients.length,
      emails: scheduledEmails.map(e => ({ id: e.id, recipient: e.recipient })),
    });
  } catch (error) {
    console.error('Schedule error:', error);
    return res.status(500).json({ error: 'Failed to schedule emails' });
  }
};

export const getScheduledEmails = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const emails = await prisma.email.findMany({
      where: {
        userId,
        status: 'SCHEDULED',
      },
      orderBy: { scheduledAt: 'asc' },
      take: 100,
    });

    return res.json(emails);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch emails' });
  }
};

export const getSentEmails = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const emails = await prisma.email.findMany({
      where: {
        userId,
        status: 'SENT',
      },
      orderBy: { sentAt: 'desc' },
      take: 100,
    });

    return res.json(emails);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch emails' });
  }
};

export const getEmailById = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    const email = await prisma.email.findFirst({
      where: { id, userId },
    });

    if (!email) {
      return res.status(404).json({ error: 'Email not found' });
    }

    return res.json(email);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch email' });
  }
};

export const searchEmails = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query required' });
    }

    try {
      const results = await esClient.search({
        index: 'emails',
        body: {
          query: {
            bool: {
              must: [
                { term: { userId } },
                {
                  multi_match: {
                    query: q,
                    fields: ['recipient', 'subject', 'body'],
                  },
                },
              ],
            },
          },
        },
      });

      const hits = (results as any).hits?.hits || [];
      const emails = hits.map((h: any) => ({
        id: h._id,
        ...h._source,
      }));

      return res.json(emails);
    } catch (esError) {
      console.error('Elasticsearch error:', esError);
      const fallbackResults = await prisma.email.findMany({
        where: {
          userId,
          OR: [
            { recipient: { contains: q as string, mode: 'insensitive' } },
            { subject: { contains: q as string, mode: 'insensitive' } },
            { body: { contains: q as string, mode: 'insensitive' } },
          ],
        },
        take: 100,
      });
      return res.json(fallbackResults);
    }
  } catch (error) {
    return res.status(500).json({ error: 'Search failed' });
  }
};

export const deleteEmail = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    await prisma.email.deleteMany({
      where: { id, userId },
    });

    return res.status(200).json({ message: 'Email deleted' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete email' });
  }
};

export const getHealth = async (req: Request, res: Response) => {
  return res.json({ status: 'healthy', timestamp: new Date().toISOString() });
};