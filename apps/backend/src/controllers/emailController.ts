import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma';
import emailQueue from '../queues/emailQueue';
import { createHash } from 'crypto';
import { indexEmail } from '../services/slackService';
import esClient from '../config/elasticsearch';

const scheduleSchema = z.object({
  subject: z.string().trim().min(1).max(998),
  body: z.string().min(1).max(100000),
  recipients: z.array(z.string().email()).min(1).max(10000),
  senderId: z.string(),
  startTime: z.string().datetime(),
  delayBetweenEmails: z.number().int().min(1000).max(3600000),
  hourlyLimit: z.number().int().min(1).max(10000),
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

    const requestKey=req.get('Idempotency-Key');
    if(!requestKey || requestKey.length>128) return res.status(400).json({error:'Idempotency-Key required'});
    const startTimeDate=new Date(startTime);
    const unique=[...new Set(recipients.map(r=>r.toLowerCase()))];
    const campaignId=createHash('sha256').update(JSON.stringify([userId,requestKey])).digest('hex');
    const fingerprint=createHash('sha256').update(JSON.stringify([subject,body,senderId,startTime,delayBetweenEmails,hourlyLimit,unique])).digest('hex');
    const result=await prisma.$transaction(async tx=>{
      const batch=await tx.scheduleRequest.upsert({where:{id:campaignId},create:{id:campaignId,fingerprint},update:{}});
      if(batch.fingerprint!==fingerprint)return null;
      const rows=unique.map((recipient,i)=>({requestKey:createHash('sha256').update(JSON.stringify([userId,requestKey,recipient])).digest('hex'),userId,senderId,recipient,subject,body,scheduledAt:new Date(startTimeDate.getTime()+i*delayBetweenEmails),delayMs:delayBetweenEmails,hourlyLimit}));
      for(let i=0;i<rows.length;i+=250)await tx.email.createMany({data:rows.slice(i,i+250),skipDuplicates:true});
      return tx.email.findMany({where:{userId,requestKey:{in:rows.map(r=>r.requestKey)}},orderBy:{createdAt:'asc'}});
    },{timeout:60000});
    if(!result)return res.status(409).json({error:'Idempotency-Key already used with a different payload'});
    const scheduledEmails=result;
    // PostgreSQL is authoritative; recovery retries enqueue failures.
    const pending=scheduledEmails.filter(e=>['SCHEDULED','DEFERRED'].includes(e.status));
    for(let i=0;i<pending.length;i+=250){
      try { await emailQueue.addBulk(pending.slice(i,i+250).map(e=>({name:'send-email',data:{emailId:e.id},opts:{jobId:`send-email-${e.id}`,delay:Math.max(0,e.scheduledAt.getTime()-Date.now())}}))); } catch(error){console.error('Enqueue pending recovery',error);break;}
    }
    return res.status(201).json({
      message: 'Emails scheduled successfully',
      campaignId,
      scheduledCount: scheduledEmails.length,
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
        status: { in: ['SCHEDULED','DEFERRED','PROCESSING'] },
      },
      orderBy: { scheduledAt: 'asc' },
      take: Math.max(1,Math.min(10000, Math.floor(Number(req.query.limit)||1000))),
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
        status: { in: ['SENT','FAILED','UNCERTAIN'] },
      },
      orderBy: { sentAt: 'desc' },
      take: Math.max(1,Math.min(10000, Math.floor(Number(req.query.limit)||1000))),
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

    if (!q || typeof q !== 'string' || q.length>200) {
      return res.status(400).json({ error: 'Search query required' });
    }

    try {
      const results = await esClient.search({
        index: 'emails',
        size: 1000,
        body: {
          query: {
            bool: {
              must: [
                { term: { userId } },
                { bool: { should: [{multi_match:{query:q,fields:['subject','body']}},{wildcard:{recipient:{value:'*'+q.replace(/[\\*?]/g,'\\$&')+'*',case_insensitive:true}}}],minimum_should_match:1 } },
              ],
            },
          },
        },
      });

      const hits = (results as any).hits?.hits || [];
      const emails = await prisma.email.findMany({where:{userId,status:{not:'CANCELLED'},OR:[{id:{in:hits.map((h:any)=>h._id)}},{indexedAt:null,OR:[{recipient:{contains:q,mode:'insensitive'}},{subject:{contains:q,mode:'insensitive'}},{body:{contains:q,mode:'insensitive'}}]}]},take:1000,orderBy:{scheduledAt:'asc'}});

      return res.json(emails);
    } catch (esError) {
      console.error('Elasticsearch error:', esError);
      const fallbackResults = await prisma.email.findMany({
        where: {
          userId,
          status:{not:'CANCELLED'},
          OR: [
            { recipient: { contains: q as string, mode: 'insensitive' } },
            { subject: { contains: q as string, mode: 'insensitive' } },
            { body: { contains: q as string, mode: 'insensitive' } },
          ],
        },
        take: Math.max(1,Math.min(10000, Math.floor(Number(req.query.limit)||1000))),
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

    const result=await prisma.email.updateMany({where:{id,userId,status:{in:['SCHEDULED','DEFERRED']}},data:{status:'CANCELLED',indexedAt:null}});
    if(!result.count) return res.status(409).json({error:'Email cannot be cancelled'});
    await emailQueue.remove(`send-email-${id}`).catch(console.error);
    await indexEmail({id});
    return res.status(200).json({ message: 'Email deleted' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete email' });
  }
};

export const getHealth = async (req: Request, res: Response) => {
  return res.json({ status: 'healthy', timestamp: new Date().toISOString() });
};