import passport from 'passport';
import { randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';
import { Request, Response } from 'express';

export const googleAuth = [
  (req:Request,res:Response,next:any)=>{const state=randomBytes(32).toString('hex');res.cookie('google_state',state,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:600000});passport.authenticate('google',{scope:['profile','email'],state,session:false})(req,res,next);},
];

export const googleCallback = [
  (req:Request,res:Response,next:any)=>{if(!req.cookies.google_state || req.query.state!==req.cookies.google_state)return res.status(400).json({error:'Invalid OAuth state'});res.clearCookie('google_state');return next();},
  passport.authenticate('google', {
    failureRedirect: (process.env.FRONTEND_URL || 'http://localhost:3000') + '/login',
    session: false,
  }),
  (req: Request, res: Response) => {
    const user = req.user as any;
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' },
    );

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.redirect((process.env.FRONTEND_URL || 'http://localhost:3000') + '/dashboard');
  },
];

export const getMe = async (req: Request, res: Response) => {
  const user=await prisma.user.findUnique({where:{id:(req.user as any).userId},select:{id:true,name:true,email:true,avatar:true}});
  return res.json({ user });
};

export const logout = (req: Request, res: Response) => {
  res.clearCookie('token',{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production'});
  res.json({ message: 'Logged out successfully' });
};