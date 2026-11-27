import 'dotenv/config';
import {validateEncryptionKey} from './utils/secrets';
import {migrateCredentials} from './services/migrateCredentials';
import emailQueue from './queues/emailQueue';
import {authMiddleware} from './middleware/auth';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import {existsSync} from 'fs';
import {reconcile} from './services/recovery';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

import prisma from './config/prisma';
import redis from './config/redis';
import esClient from './config/elasticsearch';
import router from './routes';
import emailWorker from './workers/emailWorker';
import { ensureIndexExists } from './config/elasticsearch';
import { setupBullBoard } from './integrations/bullBoard';

if(!process.env.JWT_SECRET || process.env.JWT_SECRET.startsWith('replace_') || process.env.JWT_SECRET.length<32) throw Error('JWT_SECRET must be at least 32 characters');

validateEncryptionKey();
for(const key of ['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','DATABASE_URL'])if(!process.env[key])throw Error(`${key} is required`);
for(const [key,def] of [['WORKER_CONCURRENCY',5],['MIN_EMAIL_DELAY_MS',2000],['MAX_EMAILS_PER_HOUR_PER_SENDER',100]] as const){const n=Number(process.env[key]||def);if(!Number.isSafeInteger(n)||n<1)throw Error(`${key} must be a positive integer`);}
const app = express();
app.disable('x-powered-by');
const PORT = Number(process.env.PORT || 4000);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({limit:'2mb'}));
app.use((req,res,next)=>{if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.get('origin')&&req.get('origin')!==(process.env.FRONTEND_URL||'http://localhost:3000'))return res.sendStatus(403);return next();});
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(passport.initialize());

// Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  callbackURL: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/api/auth/google/callback',
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails?.[0]?.value;
    if (!email) return done(new Error('Google profile has no email'));
    const newUser = await prisma.user.upsert({
      where: {googleId: profile.id},
      update: {name: profile.displayName, avatar: profile.photos?.[0]?.value || ''},
      create: {
        googleId: profile.id,
        name: profile.displayName,
        email,
        avatar: (profile.photos && profile.photos[0] && profile.photos[0].value) || '',
      },
    });

    return done(null as any, newUser);
  } catch (error) {
    return done(error as Error, null as any);
  }
}));

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  const user = await prisma.user.findUnique({ where: { id } });
  done(null, user);
});

// Routes
app.use('/api', router);

// Bull Board
const { router: bullBoardRouter } = setupBullBoard();
app.use('/admin/queues', authMiddleware, (req,res,next)=>{if((req.user as any).email!==process.env.ADMIN_EMAIL)return res.sendStatus(403);return next();}, bullBoardRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/ready', async (_req,res)=>{
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([Promise.all([prisma.$queryRaw`SELECT 1`,redis.ping(),esClient.ping()]),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Dependency timeout')),5000);})]);
    return res.json({status:'ready'});
  } catch { return res.status(503).json({status:'not ready'}); }
  finally { if(timer)clearTimeout(timer); }
});
const dist=path.resolve(__dirname,'../../frontend/dist');
if(existsSync(dist)){app.use(express.static(dist));app.get(['/', '/login','/dashboard','/scheduled','/sent'],(_req,res)=>res.sendFile(path.join(dist,'index.html')));}
app.use((err:Error,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{console.error(err.name);res.status(500).json({error:'Internal server error'});});
// Reconcile durable DB rows with Redis before starting the worker.
async function start(){
 await prisma.$connect();
 await migrateCredentials();
 await ensureIndexExists().catch(console.error);
 await reconcile();
 // Recovery loop is not email scheduling: BullMQ delayed jobs alone determine send time.
 let stopping=false;let timer:ReturnType<typeof setTimeout>;
 const recover=async()=>{try{await reconcile();}catch(err){console.error('Recovery:',err);}finally{if(!stopping)timer=setTimeout(recover,30000);}};
 timer=setTimeout(recover,30000);
 void emailWorker.run().catch(console.error);
 const server=app.listen(PORT,()=>console.log(`Server running on ${PORT}`));
 const close=async()=>{stopping=true;clearTimeout(timer);server.close();await emailWorker.close();await emailQueue.close();await prisma.$disconnect();process.exit(0);};
 process.once('SIGTERM',close);process.once('SIGINT',close);
}
start().catch(err=>{console.error(err);process.exit(1);});
export default app;
