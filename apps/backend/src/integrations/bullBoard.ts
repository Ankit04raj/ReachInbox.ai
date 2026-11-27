import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import queue from '../queues/emailQueue';
export function setupBullBoard(){const adapter=new ExpressAdapter();adapter.setBasePath('/admin/queues');createBullBoard({queues:[new BullMQAdapter(queue)],serverAdapter:adapter});return {router:adapter.getRouter()};}
