export const getHourlyWindow = (): string => {
  const now = new Date();
  return now.toISOString().slice(0, 13);
};

export const formatDateTime = (date: Date): string => {
  return new Date(date).toLocaleString();
};

export const parseCronTime = (date: Date): Date => {
  return new Date(date);
};