import prisma from '../config/prisma';
import {encryptSecret,isEncrypted} from '../utils/secrets';
// Compare-and-set allows concurrent startup without double-encrypting or overwriting a reconnect.
export async function migrateCredentials(){
 const senders=await prisma.sender.findMany({where:{etherealPass:{not:null}},select:{id:true,etherealPass:true}});
 for(const row of senders){const value=row.etherealPass;if(value&&!isEncrypted(value))await prisma.sender.updateMany({where:{id:row.id,etherealPass:value},data:{etherealPass:encryptSecret(value)}});}
 const tokens=await prisma.slackToken.findMany({select:{id:true,accessToken:true}});
 for(const row of tokens){if(!isEncrypted(row.accessToken))await prisma.slackToken.updateMany({where:{id:row.id,accessToken:row.accessToken},data:{accessToken:encryptSecret(row.accessToken)}});}
}
