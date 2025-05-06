import cors from 'cors';

const corsMiddleware = () => {
  const corsOptions = {
    origin: true, // Cho phép tất cả origins
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Set-Cookie']
  };

  return cors(corsOptions);
};

export default corsMiddleware;