import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';

const corsMiddleware = () => {
  const corsOptions = {
    origin: function (origin, callback) {
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://instagram-clone-seven-sable.vercel.app',
        // Thêm các origin khác nếu cần
      ];

      // Cho phép mọi origin trong quá trình phát triển
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.log('Blocked origin:', origin);
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Set-Cookie', 'Authorization'],
  };

  return cors(corsOptions);
};

const applyMiddlewares = (app) => {
  // Đặt CORS middleware trước
  app.use(corsMiddleware());

  // Sau đó các middleware khác
  app.use(cookieParser());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Đảm bảo header này luôn được đặt sau CORS
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Credentials', 'true');
    next();
  });
};
export default applyMiddlewares;