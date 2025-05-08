import express from 'express';
import { login, logout, checkAuth } from '../controllers/auth.controller.js';
import { verifyToken, updateLastLogin } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Route đăng nhập
router.post('/login', login);

// Route đăng xuất
router.post('/logout', logout);

// Route kiểm tra xác thực - sử dụng middleware cập nhật lastLogin
router.get('/check', verifyToken, updateLastLogin, checkAuth);

export default router;