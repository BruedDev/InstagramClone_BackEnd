import express from 'express';
import {
  createPost,
  getPostUser,
  getPostById,
  deletePostById
} from '../controllers/post.controllers.js';
import { verifyToken } from '../middlewares/auth.middleware.js';
import upload from '../helper/cloudinary.js';

const router = express.Router();

router.post('/create', verifyToken, upload.single('file'), createPost);
router.get('/getPostUser/:userId', verifyToken, getPostUser);
router.delete('/delete/:postId', verifyToken, deletePostById);
router.get('/:postId', verifyToken, getPostById);

export default router;
