// routes/index.routes.js
import express from 'express';
import authRoutes from './auth.routes.js';

const router = express.Router();

// Định nghĩa các routes tại đây
router.use('/api/auth', authRoutes);

export default router;
