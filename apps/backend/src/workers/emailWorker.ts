import { Worker, Queue } from 'bullmq';
import redis from '../config/redis';
import prisma from '../config/prisma';
import { reserveSendSlot, calculateDelayForNextSlot, checkHourlyCapacity } from '../services/rateLimitService';
import { notifyRateLimitHit } from '../services/slackService';
import { indexEmail } from '../services/slackService';
// @ts-ignore - nodemailer types not installed
import nodemailer from 'nodemailer';
import emailQueue from '../queues/emailQueue';

const MAX_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '5');
const MIN_DELAY_MS = parseInt(process.env.MIN_EMAIL_DELAY_MS || '2000');

const worker = new Worker('email-queue', async (job) => {
  const { emailId, userId, senderId } = job.data;

  const email = await prisma.email.findUnique({
    where: { id: emailId },
    include: { sender: true },
  });

  if (!email) {
    console.error(`Email not found: ${emailId}`);
    return;
  }

  if (email.status === 'SENT') {
    console.log(`Email already sent: ${emailId}`);
    return;
  }

  if (email.status === 'FAILED') {
    console.log(`Email previously failed: ${emailId}`);
    return;
  }

  const hasCapacity = await checkHourlyCapacity(senderId);

  if (!hasCapacity) {
    const delay = await calculateDelayForNextSlot(senderId);

    await prisma.email.update({
      where: { id: emailId },
      data: { status: 'DEFERRED' },
    });

    await notifyRateLimitHit(userId, senderId, parseInt(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || '100'));

    await emailQueue.add(
      `send-email-${emailId}`,
      { emailId, userId, senderId },
      { delay },
    );

    await indexEmail({ id: emailId, userId, status: 'DEFERRED' });

    return;
  }

  await prisma.email.update({
    where: { id: emailId },
    data: { status: 'PROCESSING' },
  });

  const sender = await prisma.sender.findUnique({
    where: { id: senderId },
  });

  if (!sender) {
    throw new Error(`Sender not found: ${senderId}`);
  }

  let etherealConfig = {
    user: sender.etherealUser,
    pass: sender.etherealPass,
    host: sender.etherealHost,
    port: sender.etherealPort,
  };

  // If no ethereal config, we'd need to generate one via nodemailer
  // For now, use a placeholder - in production this would be auto-generated
  if (!sender.etherealUser) {
    console.error('No Ethereal config for sender, using placeholder');
  }

  const transporter = nodemailer.createTransport({
    host: etherealConfig.host || 'localhost',
    port: etherealConfig.port || 1025,
    secure: etherealConfig.port === 465,
    auth: {
      user: etherealConfig.user || 'test',
      pass: etherealConfig.pass || 'test',
    },
  });

  let sendSuccess = false;
  let etherealUrl: string | null = null;

  try {
    const info = await transporter.sendMail({
      from: sender.email,
      to: email.recipient,
      subject: email.subject,
      html: email.body,
    });

    sendSuccess = true;
    etherealUrl = info.messageUrl || null;

    await reserveSendSlot(senderId);
  } catch (error) {
    console.error(`Failed to send email ${emailId}:`, error);
  }

  await prisma.email.update({
    where: { id: emailId },
    data: {
      status: sendSuccess ? 'SENT' : 'FAILED',
      sentAt: sendSuccess ? new Date() : undefined,
      etherealUrl,
    },
  });

  await indexEmail({ ...email, status: sendSuccess ? 'SENT' : 'FAILED', sentAt: new Date(), etherealUrl });

}, {
  connection: redis,
  concurrency: MAX_CONCURRENCY,
  removeOnComplete: 100,
  removeOnFail: 100,
} as any);

// QueueScheduler is optional in BullMQ v5 - only needed for queue maintenance
// If not available, the queue will still work without it

worker.on('completed', (job) => {
  console.log(`Job completed: ${job.id}`);
});

worker.on('failed', (job, err) => {
  console.error(`Job failed: ${job?.id}`, err);
});

worker.on('error', (err) => {
  console.error('Worker error:', err);
});

export default worker;