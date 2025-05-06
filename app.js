// app.js
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes.js';
import corsMiddleware from './middlewares/cors.middleware.js';
import cookieParser from 'cookie-parser';

// Load env variables
dotenv.config();

const app = express();

// Middleware
app.use(cookieParser());
app.use(express.json());
app.use(corsMiddleware());
app.use(express.urlencoded({ extended: true }));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Kết nối MongoDB thành công'))
  .catch(err => console.error('Lỗi kết nối MongoDB:', err));

// Routes
app.use('/api/auth', authRoutes);

// Default route
app.get('/', (req, res) => {
  res.send('API Instagram Clone đang hoạt động');
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server đang chạy trên cổng ${PORT}`);
});

export default app;