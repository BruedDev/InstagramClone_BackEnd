import express from 'express';
import { login, logout, checkAuth, register, facebookLogin, facebookCallback } from '../controllers/auth.controller.js';
import { authenticateJWT, verifyToken } from '../middlewares/auth.middleware.js';
import passport from 'passport';

const router = express.Router();

const combinedAuth = (req, res, next) => {
  // Thử sử dụng authenticateJWT trước
  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (user) {
      // Nếu authenticateJWT thành công, tiếp tục
      req.user = user;
      return next();
    }

    // Nếu authenticateJWT thất bại, thử dùng verifyToken
    verifyToken(req, res, next);
  })(req, res, next);
};

router.post('/login', login);
router.post('/register', register);
router.post('/logout', logout);
router.get('/check', combinedAuth, checkAuth);

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