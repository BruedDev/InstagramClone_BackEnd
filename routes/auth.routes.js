import express from 'express';
import { login, logout, checkAuth, register, facebookLogin } from '../controllers/auth.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/login', login);
router.post('/facebook/login', facebookLogin);
router.post('/register', register);
router.post('/logout', logout);
router.get('/check', verifyToken, checkAuth);

export default router;