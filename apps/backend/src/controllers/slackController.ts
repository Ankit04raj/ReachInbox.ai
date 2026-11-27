import {encryptSecret} from '../utils/secrets';
import { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import prisma from '../config/prisma';
import redis from '../config/redis';
const front=()=>process.env.FRONTEND_URL||'http://localhost:3000';
export async function connect(req:Request,res:Response) {
 const state=randomBytes(32).toString('hex');
 if(!process.env.SLACK_CLIENT_ID || !process.env.SLACK_CLIENT_SECRET) return res.status(503).json({error:'Slack not configured'});
 await redis.set(`slack-state:${state}`,(req.user as any).userId,'EX',600);
 const q=new URLSearchParams({client_id:process.env.SLACK_CLIENT_ID,scope:'incoming-webhook',redirect_uri:process.env.SLACK_REDIRECT_URI||'http://localhost:4000/api/slack/callback',state});
 return res.redirect('https://slack.com/oauth/v2/authorize?'+q);
}
export async function callback(req:Request,res:Response) {
 const state=String(req.query.state||'');
 const owner=await redis.getdel(`slack-state:${state}`);
 if(owner!==(req.user as any).userId || !owner || typeof req.query.code!=='string') return res.status(400).json({error:'Invalid Slack OAuth state'});
 const r=await fetch('https://slack.com/api/oauth.v2.access',{method:'POST',signal:AbortSignal.timeout(10000),body:new URLSearchParams({client_id:process.env.SLACK_CLIENT_ID!,client_secret:process.env.SLACK_CLIENT_SECRET!,code:req.query.code,redirect_uri:process.env.SLACK_REDIRECT_URI||'http://localhost:4000/api/slack/callback'})});
 const data=await r.json() as any;
 if(!data.ok || !data.incoming_webhook?.url) return res.status(502).json({error:'Slack authorization failed'});
 const values={accessToken:encryptSecret(data.incoming_webhook.url),teamId:data.team.id,channelId:data.incoming_webhook.channel_id,connected:true};
 await prisma.slackToken.upsert({where:{userId:owner},create:{userId:owner,...values},update:values});
 return res.redirect(front()+'/dashboard');
}
export async function status(req:Request,res:Response) { const t=await prisma.slackToken.findUnique({where:{userId:(req.user as any).userId}}); return res.json({connected:!!t?.connected}); }
export async function disconnect(req:Request,res:Response) { const userId=(req.user as any).userId;await prisma.$transaction([prisma.slackToken.deleteMany({where:{userId}}),prisma.slackNotice.deleteMany({where:{userId,deliveredAt:null}})]); return res.json({connected:false}); }
