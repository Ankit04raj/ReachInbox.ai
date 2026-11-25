// BullBoard integration - simplified for build compatibility
// In production, use full @bull-board/api with proper adapters

import { ExpressAdapter } from '@bull-board/express';

export const setupBullBoard = () => {
  const serverAdapter = new ExpressAdapter();

  // Simple mock - in production, use createBullBoard properly
  return { router: serverAdapter.getRouter() };
};