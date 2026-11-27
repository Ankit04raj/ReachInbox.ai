import redis from '../config/redis';
// Atomic admission: Redis server time, fixed UTC hour, per-sender spacing.
export const admissionScript = `
local t=redis.call('TIME'); local now=t[1]*1000+math.floor(t[2]/1000)
local hour=math.floor(now/3600000); local endAt=(hour+1)*3600000
local key=KEYS[1]..':'..hour
local count=tonumber(redis.call('GET',key) or '0')
local cap=tonumber(ARGV[1]); local gap=tonumber(ARGV[2])
if count>=cap then return {endAt-now,0,count} end
local nextAt=tonumber(redis.call('GET',KEYS[2]) or '0')
if nextAt>now then return {nextAt-now,0,count} end
count=redis.call('INCR',key); redis.call('PEXPIREAT',key,endAt)
redis.call('PSETEX',KEYS[2],gap,tostring(now+gap))
return {0,1,count}
`;
export async function admit(senderId:string, cap:number, gap:number) {
 const [wait,allowed,count]=await redis.eval(admissionScript,2,`rate:{${senderId}}`,`next:{${senderId}}`,cap,gap) as number[];
 return {wait,allowed:Boolean(allowed),count};
}
