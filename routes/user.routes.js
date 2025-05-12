import express from 'express';
import { deleteUser, getUser } from '../controllers/user.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

// API xóa người dùng theo ID
router.get('/getUser/:identifier', verifyToken, getUser);
router.delete('/deleteUser/:id', verifyToken, deleteUser);

export default router;