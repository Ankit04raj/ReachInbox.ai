import { WebClient } from '@slack/web-api';
import prisma from '../config/prisma';
import esClient from '../config/elasticsearch';
import { getHourlyWindow } from '../utils/timeUtils';

const sendSlackNotification = async (userId: string, senderEmail: string, count: number) => {
  const slackToken = await prisma.slackToken.findUnique({
    where: { userId },
  });

  if (!slackToken || !slackToken.connected) {
    return { success: false, reason: 'Slack not connected' };
  }

  const slack = new WebClient(slackToken.accessToken);
  const message = `⚠️ Email Hourly Limit Reached\n\nSender: ${senderEmail}\nEmails sent this hour: ${count}\n\nMore emails will be deferred to the next hour window.`;

  try {
    await slack.chat.postMessage({
      channel: slackToken.teamId,
      text: message,
    });
    return { success: true };
  } catch (error) {
    console.error('Slack notification error:', error);
    return { success: false, reason: 'Slack API error' };
  }
};

export const notifyRateLimitHit = async (userId: string, senderId: string, emailCount: number) => {
  const sender = await prisma.sender.findUnique({
    where: { id: senderId },
  });

  if (sender) {
    await sendSlackNotification(userId, sender.email, emailCount);
  }
};

export const indexEmail = async (email: any) => {
  try {
    await esClient.index({
      index: 'emails',
      id: email.id,
      body: {
        id: email.id,
        userId: email.userId,
        recipient: email.recipient,
        subject: email.subject,
        body: email.body,
        status: email.status,
        scheduledAt: email.scheduledAt,
        sentAt: email.sentAt,
      },
    });
  } catch (error) {
    console.error('Elasticsearch indexing error:', error);
    // Retry mechanism could be implemented here
  }
};