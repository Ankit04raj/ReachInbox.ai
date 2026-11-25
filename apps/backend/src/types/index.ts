export interface ScheduleEmailRequest {
  subject: string;
  body: string;
  recipients: string[];
  senderId: string;
  startTime: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
}

export interface EmailResponse {
  id: string;
  subject: string;
  recipient: string;
  scheduledAt: Date;
  sentAt: Date | null;
  status: string;
  etherealUrl: string | null;
}

// JWT payload from token
export interface JwtPayload {
  userId: string;
  email: string;
  name?: string;
  avatar?: string | null;
  googleId?: string;
}