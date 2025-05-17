import express from 'express';
import {
  sendMessage,
  getMessages,
  getUserMessages,
  getUnreadCount,
  checkUserStatus
} from '../controllers/messenger.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Gửi tin nhắn
router.post('/sendMessage', verifyToken, sendMessage);

// Lấy tin nhắn giữa 2 người dùng
router.get('/messages/:userId', verifyToken, getMessages);

// Lấy danh sách người dùng để nhắn tin
router.get('/users', verifyToken, getUserMessages);

// Lấy số lượng tin nhắn chưa đọc
router.get('/unread-count/:senderId', verifyToken, getUnreadCount);

// trạng thái online/ offline
router.get('/status/:userId', verifyToken, checkUserStatus);


export default router;