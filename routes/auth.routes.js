import express from 'express';
import { login, logout, checkAuth, register, facebookCallback } from '../controllers/auth.controller.js';
import { authenticateJWT } from '../middlewares/auth.middleware.js';
import passport from 'passport';

const router = express.Router();

router.post('/login', login);
router.post('/register', register);
router.post('/logout', logout);
router.get('/check', authenticateJWT, checkAuth);

// Thêm routes cho Facebook OAuth
router.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }));
router.get(
  '/facebook/callback',
  passport.authenticate('facebook', {
    failureRedirect: 'https://instagram-clone-seven-sable.vercel.app/accounts/login',
    session: false
  }),
  facebookCallback
);

export default router;