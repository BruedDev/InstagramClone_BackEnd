import express from 'express';
import dotenv from 'dotenv';
import applyMiddlewares from './middlewares/cors.middleware.js';
import connectDB from './config/db.config.js';
import routes from './routes/index.routes.js';


dotenv.config();

const app = express();

// Kết nối MongoDB trước khi tiếp tục
connectDB();

// Áp dụng middleware
applyMiddlewares(app);

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