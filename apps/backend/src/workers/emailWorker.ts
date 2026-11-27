import {decryptSecret} from '../utils/secrets';
import { Worker, DelayedError } from 'bullmq';
import redis from '../config/redis';
import prisma from '../config/prisma';
import { admit } from '../services/rateLimitService';
import { notifyRateLimitHit, indexEmail } from '../services/slackService';
// @ts-ignore nodemailer types not bundled
import nodemailer from 'nodemailer';
const worker = new Worker('email-queue', async (job, token) => {
 const email = await prisma.email.findUnique({where:{id:job.data.emailId},include:{sender:true}});
 if (!email || ['SENT','FAILED','PROCESSING','CANCELLED','UNCERTAIN'].includes(email.status)) return;
 if(email.scheduledAt.getTime()>Date.now()){await job.moveToDelayed(email.scheduledAt.getTime(),token);throw new DelayedError();}
 const sender=email.sender;
 const cap=Math.min(email.hourlyLimit,sender.hourlyLimit,Number(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || 100));
 const gap=Math.max(email.delayMs,sender.minimumDelay,Number(process.env.MIN_EMAIL_DELAY_MS || 2000));
 // Shared demo SMTP accounts must share the same distributed quota across tenants.
 const slot=await admit((sender.etherealUser || sender.email).trim().toLowerCase(),cap,gap);
 if (!slot.allowed) {
   const at=Date.now()+Math.max(100,slot.wait);
   const row=await prisma.email.updateMany({where:{id:email.id,status:{in:['SCHEDULED','DEFERRED']}},data:{status:'DEFERRED',scheduledAt:new Date(at),indexedAt:null}});
   if(slot.count>=cap)await notifyRateLimitHit(email.userId,sender.id,slot.count).catch(console.error);
   if(!row.count)return; await job.moveToDelayed(at,token);throw new DelayedError();
 }
 const claimed=await prisma.email.updateMany({where:{id:email.id,status:{in:['SCHEDULED','DEFERRED']}},data:{status:'PROCESSING',indexedAt:null}});
 if (!claimed.count) return;

 let info:any;
 try {
   if(!sender.etherealUser || !sender.etherealPass){await indexEmail(await prisma.email.update({where:{id:email.id},data:{status:'FAILED',indexedAt:null}}));return;}
   const transport=nodemailer.createTransport({host:'smtp.ethereal.email',port:587,secure:false,requireTLS:true,auth:{user:sender.etherealUser,pass:decryptSecret(sender.etherealPass)},connectionTimeout:15000,socketTimeout:30000});
   const sending=transport.sendMail({from:sender.email,to:email.recipient,subject:email.subject,html:email.body,messageId:`<${email.id}@reachinbox.local>`});
   if(slot.count===cap)void notifyRateLimitHit(email.userId,sender.id,slot.count).catch(console.error);
   info=await sending;
 } catch(err) {
   console.error('SMTP outcome failed or uncertain',email.id,err instanceof Error?err.name:'unknown');
   await indexEmail(await prisma.email.update({where:{id:email.id},data:{status:'UNCERTAIN',indexedAt:null}})); return;
 }
 await indexEmail(await prisma.email.update({where:{id:email.id},data:{status:'SENT',indexedAt:null,sentAt:new Date(),etherealUrl:nodemailer.getTestMessageUrl(info)||null}}));
}, {connection:redis,concurrency:Number(process.env.WORKER_CONCURRENCY||5),autorun:false});
worker.on('error',console.error); worker.on('failed',(job,err)=>console.error(job?.id,err));
export default worker;
