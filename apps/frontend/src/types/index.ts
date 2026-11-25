export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  googleId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Email {
  id: string;
  userId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt?: string | null;
  status: 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED' | 'DEFERRED';
  etherealUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Sender {
  id: string;
  userId: string;
  email: string;
  hourlyLimit: number;
  minimumDelay: number;
  etherealUser?: string | null;
  etherealPass?: string | null;
  etherealHost?: string | null;
  etherealPort?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SlackToken {
  id: string;
  userId: string;
  accessToken: string;
  teamId: string;
  connected: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Stats {
  scheduled: number;
  sent: number;
  failed: number;
}

export interface ScheduleEmailRequest {
  subject: string;
  body: string;
  recipients: string[];
  senderId: string;
  startTime: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
}