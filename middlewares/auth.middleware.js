import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';

export const verifyToken = async (req, res, next) => {
  try {
    // Lấy token từ nhiều nguồn khác nhau để đảm bảo hoạt động trên mọi nền tảng
    let token;

    // 1. Lấy từ cookies (thường hoạt động trên Windows)
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    // 2. Lấy từ Authorization header (Bearer token)
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // 3. Lấy từ Authorization header nếu không có prefix "Bearer"
    else if (req.headers.authorization) {
      token = req.headers.authorization;
    }

    // 4. Kiểm tra trong query parameters (cho mobile apps)
    else if (req.query && req.query.token) {
      token = req.query.token;
    }

    // 5. Kiểm tra trong body (một số client gửi token trong body)
    else if (req.body && req.body.token) {
      token = req.body.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verify user still exists in database
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.log('Authentication error:', error.message);
    res.clearCookie('token');
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};