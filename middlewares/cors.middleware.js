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
      ];
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true); // ✅ Dùng true để tự động set Access-Control-Allow-Origin đúng
      } else {
        callback(new Error('Not allowed by CORS'));
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
  app.use(corsMiddleware()); // ✅ Đặt lên đầu
  app.use(cookieParser());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
};

export default applyMiddlewares;
