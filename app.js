import express from 'express';
import dotenv from 'dotenv';
import session from 'express-session';
import applyMiddlewares from './middlewares/cors.middleware.js';
import connectDB from './config/db.config.js';
import configPassport from './config/passport.config.js';
import routes from './routes/index.routes.js';

dotenv.config();

const app = express();

// Kết nối MongoDB trước khi tiếp tục
connectDB();

// Áp dụng middleware
applyMiddlewares(app);

// Cấu hình session
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'instagram-clone-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    },
  })
);

// Cấu hình Passport
configPassport(app);

// Áp dụng routes
app.use(routes);

app.get('/', (req, res) => {
  res.send('API Instagram Clone đang hoạt động');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server đang chạy trên cổng ${PORT}`);
});

export default app;