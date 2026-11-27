import {ensureIndexExists} from '../config/elasticsearch';
import prisma from '../config/prisma';
import queue from '../queues/emailQueue';
import {indexEmail,retryNotices} from './slackService';
export async function reconcile(){
 // Recover DB commits that were not enqueued, even if API process did not restart.
 const rows=await prisma.email.findMany({where:{status:{in:['SCHEDULED','DEFERRED']}},orderBy:{scheduledAt:'asc'}});
 for(const row of rows){
  const id=`send-email-${row.id}`;
  const job=await queue.getJob(id);
  if(job){const state=await job.getState();if(state==='failed'||state==='completed')await job.retry(state).catch(()=>undefined);}
  else await queue.add('send-email',{emailId:row.id},{jobId:id,delay:Math.max(0,row.scheduledAt.getTime()-Date.now())});
 }
 // No automatic SMTP retry for a stale claim: delivery may have happened before a crash.
 const cutoff=new Date(Date.now()-10*60*1000);
 const stale=await prisma.email.findMany({where:{status:'PROCESSING',updatedAt:{lt:cutoff}}});
 for(const row of stale){const result=await prisma.email.updateMany({where:{id:row.id,status:'PROCESSING',updatedAt:{lt:cutoff}},data:{status:'UNCERTAIN',indexedAt:null}});if(result.count)await indexEmail(row);}
 await retryNotices();
 await ensureIndexExists().catch(console.error);
 const unindexed=await prisma.email.findMany({where:{indexedAt:null},orderBy:{updatedAt:'asc'},take:250});
 for(let i=0;i<unindexed.length;i+=10)await Promise.all(unindexed.slice(i,i+10).map(indexEmail));
}
