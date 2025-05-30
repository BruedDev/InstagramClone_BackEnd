import express from 'express';
import dotenv from 'dotenv';
import http from 'http';
import applyMiddlewares from './middlewares/cors.middleware.js';
import connectDB from './config/db.config.js';
import routes from './routes/index.routes.js';
import { initSocket } from './middlewares/socket.middleware.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Khởi tạo Socket.IO
initSocket(server);

// Kết nối database
connectDB();

// Áp dụng middleware
applyMiddlewares(app);

// Áp dụng routes
app.use(routes);

// Route test
app.get('/', (req, res) => {
  res.send('API Instagram Clone đang hoạt động');
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server đang chạy trên cổng ${PORT}`);
});

export default app;