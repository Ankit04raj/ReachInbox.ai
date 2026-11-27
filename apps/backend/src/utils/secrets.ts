import {createCipheriv,createDecipheriv,randomBytes} from 'crypto';
const PREFIX='enc:v1:';
function key():Buffer {
 const value=process.env.CREDENTIAL_ENCRYPTION_KEY||'';
 if(!/^[a-fA-F0-9]{64}$/.test(value)) throw new Error('CREDENTIAL_ENCRYPTION_KEY must be 64 hexadecimal characters');
 return Buffer.from(value,'hex');
}
export function validateEncryptionKey(){key();}
export function encryptSecret(value:string):string {
 const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',key(),iv);
 const data=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
 return PREFIX+[iv,cipher.getAuthTag(),data].map(v=>v.toString('base64')).join(':');
}
export function decryptSecret(value:string):string {
 if(!value.startsWith(PREFIX))throw new Error('Unencrypted credential; run credential migration');
 const parts=value.slice(PREFIX.length).split(':');if(parts.length!==3)throw new Error('Invalid encrypted credential');
 const [iv,tag,data]=parts.map(v=>Buffer.from(v,'base64'));
 const decipher=createDecipheriv('aes-256-gcm',key(),iv);decipher.setAuthTag(tag);
 return Buffer.concat([decipher.update(data),decipher.final()]).toString('utf8');
}
export function isEncrypted(value:string){return value.startsWith(PREFIX);}
