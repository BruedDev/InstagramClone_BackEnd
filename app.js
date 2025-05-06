// app.js
const express = require('express');
const app = express();

// Cấu hình port (mặc định 5000)
const PORT = process.env.PORT || 5000;

// Middleware cơ bản (tùy chọn)
app.use(express.json()); // parse body JSON
app.use(express.urlencoded({ extended: true })); // parse body form

// Route mặc định
app.get('/', (req, res) => {
  res.send('Hello from Express!');
});

// Khởi động server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
