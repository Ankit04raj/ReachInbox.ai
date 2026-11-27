import {encryptSecret} from '../utils/secrets';
import {Request,Response} from 'express';
import prisma from '../config/prisma';
export async function list(req:Request,res:Response){
 const userId=(req.user as any).userId;
 const accounts=JSON.parse(process.env.ETHEREAL_ACCOUNTS_JSON||'[]') as {user:string;pass:string}[];
 for(const account of accounts){if(!account.user||!account.pass||account.pass==='replace')continue;const values={etherealUser:account.user,etherealPass:encryptSecret(account.pass),etherealHost:'smtp.ethereal.email',etherealPort:587};await prisma.sender.upsert({where:{userId_email:{userId,email:account.user}},update:values,create:{userId,email:account.user,...values,hourlyLimit:Number(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER||100),minimumDelay:Number(process.env.MIN_EMAIL_DELAY_MS||2000)}});}
 return res.json(await prisma.sender.findMany({where:{userId},select:{id:true,email:true,hourlyLimit:true,minimumDelay:true}}));
}
