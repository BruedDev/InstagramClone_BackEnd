import express from 'express';
import { getPostHome, suggestUsers, getStoryHome, createStory, getArchivedStories } from '../controllers/home.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';
import upload from '../helper/cloudinary.js';

const router = express.Router();

router.get('/getPostHome', getPostHome);
router.get('/suggestUsers', verifyToken, suggestUsers);
router.get('/getStoryHome', verifyToken, getStoryHome);
router.get('/archived-stories', verifyToken, getArchivedStories);

// Cập nhật route createStory để hỗ trợ upload nhiều file
router.post('/createStory',
  verifyToken,
  upload.fields([
    { name: 'media', maxCount: 1 },    // File media chính (ảnh hoặc video)
    { name: 'audio', maxCount: 1 }     // File audio tùy chọn
  ]),
  createStory
);

export default router;