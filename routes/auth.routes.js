import express from 'express';
import { login, logout, checkAuth, register, facebookLogin, facebookCallback } from '../controllers/auth.controller.js';
import { verifyToken, authenticateJWT } from '../middlewares/auth.middleware.js';
import passport from 'passport';

const router = express.Router();

router.post('/login', login);
router.post('/facebook/login', facebookLogin); // Giữ nguyên API cho frontend gọi trực tiếp
router.post('/register', register);
router.post('/logout', logout);
router.get('/check', authenticateJWT, checkAuth);

// Thêm routes cho Facebook OAuth
router.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }));
router.get(
  '/facebook/callback',
  passport.authenticate('facebook', {
    failureRedirect: '/login',
    session: false
  }),
  facebookCallback
);

export default router;