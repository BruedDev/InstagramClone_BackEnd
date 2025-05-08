import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';

/**
 * Xác thực token JWT từ request
 * @param {Object} req - Request
 * @param {Object} res - Response
 * @param {Function} next - Next middleware
 */
export const verifyToken = (req, res, next) => {
  try {
    // Lấy token từ cookie hoặc Authorization header
    let token = null;

    // Kiểm tra cookie
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    // Kiểm tra Authorization header (Bearer token)
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Nếu không tìm thấy token
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Không tìm thấy token xác thực. Vui lòng đăng nhập lại.'
      });
    }

    // Xác thực token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Gắn thông tin người dùng vào request để sử dụng ở controller tiếp theo
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      username: decoded.username,
      role: decoded.role
    };

    // Chuyển đến middleware tiếp theo
    next();
  } catch (error) {
    console.error('Lỗi xác thực token:', error);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token đã hết hạn. Vui lòng đăng nhập lại.'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token không hợp lệ. Vui lòng đăng nhập lại.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi xác thực token',
      error: error.message
    });
  }
};

/**
 * Kiểm tra quyền admin
 * @param {Object} req - Request
 * @param {Object} res - Response
 * @param {Function} next - Next middleware
 */
export const verifyAdmin = (req, res, next) => {
  try {
    // Phải được xác thực trước
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Không tìm thấy thông tin xác thực. Vui lòng đăng nhập lại.'
      });
    }

    // Kiểm tra quyền admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Không có quyền truy cập'
      });
    }

    // Chuyển đến middleware tiếp theo
    next();
  } catch (error) {
    console.error('Lỗi kiểm tra quyền admin:', error);
    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi kiểm tra quyền',
      error: error.message
    });
  }
};

/**
 * Cập nhật thời gian đăng nhập cuối
 * @param {Object} req - Request
 * @param {Object} res - Response
 * @param {Function} next - Next middleware
 */
export const updateLastLogin = async (req, res, next) => {
  try {
    if (req.user && req.user.userId) {
      // Cập nhật lastLogin mà không cần chờ đợi
      User.findByIdAndUpdate(req.user.userId, { lastLogin: new Date() })
        .exec()
        .catch(err => console.error('Lỗi cập nhật lastLogin:', err));
    }
    next();
  } catch (error) {
    // Không trả về lỗi, chỉ ghi log
    console.error('Lỗi cập nhật lastLogin:', error);
    next();
  }
};