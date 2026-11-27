import {decryptSecret} from '../utils/secrets';
import prisma from '../config/prisma';
import esClient from '../config/elasticsearch';
export async function notifyRateLimitHit(userId:string,senderId:string,count:number) {
 const token=await prisma.slackToken.findUnique({where:{userId}});
 if(!token?.connected)return;
 const id=`${senderId}-${Math.floor(Date.now()/3600000)}`;
 await prisma.slackNotice.upsert({where:{id},create:{id,userId,senderId,count},update:{}});
 await deliverNotice(id);
}
async function deliverNotice(id:string){
 const now=new Date();
 const claimed=await prisma.slackNotice.updateMany({where:{id,deliveredAt:null,nextAttempt:{lte:now}},data:{attempts:{increment:1},nextAttempt:new Date(now.getTime()+60000)}});
 if(!claimed.count)return;
 const notice=await prisma.slackNotice.findUniqueOrThrow({where:{id}});
 const token=await prisma.slackToken.findUnique({where:{userId:notice.userId}});
 if(!token?.connected){await prisma.slackNotice.update({where:{id},data:{deliveredAt:new Date()}});return;}
 try{
 const sender=await prisma.sender.findUnique({where:{id:notice.senderId}});
 const url=new URL(decryptSecret(token.accessToken));if(url.protocol!=='https:'||url.hostname!=='hooks.slack.com')throw Error('Invalid Slack webhook');
 const response=await fetch(url,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:`Hourly email limit reached for ${sender?.email}: ${notice.count}. Remaining jobs will be deferred.`}),signal:AbortSignal.timeout(5000)});
 if(!response.ok)throw Error(`Slack HTTP ${response.status}`);
 await prisma.slackNotice.update({where:{id},data:{deliveredAt:new Date()}});
 }catch(err){await prisma.slackNotice.update({where:{id},data:{nextAttempt:new Date(Date.now()+Math.min(3600000,30000*2**Math.min(notice.attempts,7)))}});console.error('Slack notification will retry',id);}
}
export async function retryNotices(){
 const rows=await prisma.slackNotice.findMany({where:{deliveredAt:null,nextAttempt:{lte:new Date()}},take:100,orderBy:{nextAttempt:'asc'}});
 for(const row of rows)await deliverNotice(row.id);
}
export async function indexEmail(email:any) {
 try { const current=await prisma.email.findUnique({where:{id:email.id}});if(!current)return;const {id,userId,recipient,subject,body,status,scheduledAt,sentAt}=current;
 if(status==='CANCELLED'){await esClient.delete({index:'emails',id}).catch(err=>{if(err?.meta?.statusCode!==404)throw err;});}else{
 await esClient.index({index:'emails',id,version:current.updatedAt.getTime(),version_type:'external_gte',document:{id,userId,recipient,subject,body,status,scheduledAt,sentAt}});}
 // Raw SQL avoids changing updatedAt on an index acknowledgement.
 await prisma.$executeRaw`UPDATE "Email" SET "indexedAt"=NOW() WHERE id=${id} AND "updatedAt"=${current.updatedAt}`;
 } catch(err) { console.error('Indexing failed',err); }
}
