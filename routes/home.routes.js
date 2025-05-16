import express from 'express';
import { getPostHome } from '../controllers/home.controller.js';

const router = express.Router();
router.get('/getPostHome', getPostHome);
export default router;