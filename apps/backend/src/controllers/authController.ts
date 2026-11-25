import passport from 'passport';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';
import { Request, Response } from 'express';

export const googleAuth = [
  passport.authenticate('google', { scope: ['profile', 'email'] }),
];

export const googleCallback = [
  passport.authenticate('google', {
    failureRedirect: '/login',
    session: false,
  }),
  (req: Request, res: Response) => {
    const user = req.user as any;
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' },
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.redirect(process.env.FRONTEND_URL || 'http://localhost:3000' + '/dashboard');
  },
];

export const getMe = (req: Request, res: Response) => {
  return res.json({ user: req.user });
};

export const logout = (req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
};