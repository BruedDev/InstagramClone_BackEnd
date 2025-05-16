import express from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import http from 'http';
import https from 'https';
import applyMiddlewares from './middlewares/cors.middleware.js';
import connectDB from './config/db.config.js';
import routes from './routes/index.routes.js';
import { initSocket } from './middlewares/socket.middleware.js';

dotenv.config();

const app = express();

let server;

const keyPath = process.env.SSL_KEY_PATH || '/path/to/key.pem';
const certPath = process.env.SSL_CERT_PATH || '/path/to/cert.pem';

if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  const privateKey = fs.readFileSync(keyPath, 'utf8');
  const certificate = fs.readFileSync(certPath, 'utf8');

  server = https.createServer({ key: privateKey, cert: certificate }, app);
  console.log('⚡️ Server đang chạy trên HTTPS');
} else {
  server = http.createServer(app);
  console.log('⚡️ Server đang chạy trên HTTP');
}

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
