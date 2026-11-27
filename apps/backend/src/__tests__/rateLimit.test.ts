import {randomUUID} from 'crypto';
import redis from '../config/redis';
import {admit} from '../services/rateLimitService';
afterAll(async()=>{await redis.quit();});
test('concurrent calls admit only one sender slot during a gap',async()=>{const sender=randomUUID();const results=await Promise.all(Array.from({length:30},()=>admit(sender,100,2000)));expect(results.filter(r=>r.allowed)).toHaveLength(1);expect(results.filter(r=>!r.allowed).every(r=>r.wait>0)).toBe(true);});
test('hourly limit denies later calls and returns next window delay',async()=>{const sender=randomUUID();expect((await admit(sender,1,10)).allowed).toBe(true);const blocked=await admit(sender,1,10);expect(blocked.allowed).toBe(false);expect(blocked.wait).toBeGreaterThan(0);expect(blocked.wait).toBeLessThanOrEqual(3600000);});
test('independent senders have independent capacity',async()=>{const a=randomUUID(),b=randomUUID();expect((await admit(a,1,2000)).allowed).toBe(true);expect((await admit(b,1,2000)).allowed).toBe(true);});
