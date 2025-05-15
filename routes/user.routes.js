import express from 'express';
import { deleteUser, getUser, uploadAvatar, deleteAvatar, updateBio } from '../controllers/user.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';
import upload from '../helper/cloudinary.js';

const router = express.Router();

router.get('/getUser/:identifier', verifyToken, getUser);
router.delete('/deleteUser/:id', verifyToken, deleteUser);

// 👇 Thêm 2 route mới
router.post('/uploadAvatar', verifyToken, upload.single('file'), uploadAvatar);
router.delete('/deleteAvatar', verifyToken, deleteAvatar);
router.put('/updateBio', verifyToken, updateBio);

export default router;
