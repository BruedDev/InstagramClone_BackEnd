import express from 'express';
import { getPostHome, suggestUsers, getStoryHome } from '../controllers/home.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/getPostHome', getPostHome);
router.get('/suggestUsers', verifyToken, suggestUsers);
router.get('/getStoryHome', verifyToken, getStoryHome);

export default router;