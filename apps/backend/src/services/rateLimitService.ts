import redis from '../config/redis';

const getHourWindow = () => {
  const now = new Date();
  return now.toISOString().slice(0, 13);
};

export const checkHourlyCapacity = async (senderId: string): Promise<boolean> => {
  const window = getHourWindow();
  const key = `email_count:${senderId}:${window}`;
  const current = await redis.get(key);
  const maxEmails = parseInt(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || '100');
  return (current ? parseInt(current) : 0) < maxEmails;
};

export const reserveSendSlot = async (senderId: string): Promise<number | null> => {
  const window = getHourWindow();
  const key = `email_count:${senderId}:${window}`;
  const maxEmails = parseInt(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || '100');

  const current = await redis.get(key);
  const count = current ? parseInt(current) : 0;

  if (count >= maxEmails) {
    return null;
  }

  await redis.incr(key);
  await redis.expire(key, 3600);

  return count + 1;
};

export const getNextAvailableHour = async (senderId: string): Promise<Date> => {
  const now = new Date();
  const maxEmails = parseInt(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || '100');

  let count: number;
  let key = `email_count:${senderId}:${getHourWindow()}`;

  count = await redis.get(key).then(c => (c ? parseInt(c) : 0));
  const nextHour = new Date(now.getTime() + 60 * 60 * 1000);

  while (count >= maxEmails) {
    now.setTime(now.getTime() + 60 * 60 * 1000);
    const nextWindow = now.toISOString().slice(0, 13);
    key = `email_count:${senderId}:${nextWindow}`;
    count = await redis.get(key).then(c => (c ? parseInt(c) : 0));
  }

  return now;
};

export const calculateDelayForNextSlot = async (senderId: string): Promise<number> => {
  const nextAvailable = await getNextAvailableHour(senderId);
  const now = new Date();
  return Math.max(0, nextAvailable.getTime() - now.getTime());
};