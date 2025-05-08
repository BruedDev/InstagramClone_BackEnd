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
        process.env.FRONTEND_URL,
      ].filter(Boolean); // Lọc bỏ giá trị null/undefined

      // Cho phép các request từ không có origin (như mobile apps)
      if (!origin || allowedOrigins.some(allowed => origin.includes(allowed))) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  };

  return cors(corsOptions);
};

const applyMiddlewares = (app) => {
  app.use(cookieParser());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(corsMiddleware());

  // Thêm các header cần thiết sau CORS
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && origin.includes(process.env.FRONTEND_URL)) {
      res.header('Access-Control-Allow-Origin', origin);
    }
    res.header('Access-Control-Allow-Credentials', 'true');
    next();
  });
};

export default applyMiddlewares;
