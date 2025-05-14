import express from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import postRoutes from './post.routes.js';

const router = express.Router();

router.use('/api/auth', authRoutes);
router.use('/api/user', userRoutes);
router.use('/api/posts', postRoutes);

export default router;
