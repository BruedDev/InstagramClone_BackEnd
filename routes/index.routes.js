import express from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import postRoutes from './post.routes.js';
import homeRoutes from './home.routes.js';
import messengerRoutes from './messenger.routes.js';
import storyRoutes from './story.routes.js';
import iceTokenRoute from './ice-token.routes.js';



const router = express.Router();

router.use('/api/auth', authRoutes);
router.use('/api/user', userRoutes);
router.use('/api/posts', postRoutes);
router.use('/api/home', homeRoutes);
router.use('/api/messenger', messengerRoutes);
router.use('/api/story', storyRoutes);
router.use('/api/ice-token', iceTokenRoute);


export default router;
