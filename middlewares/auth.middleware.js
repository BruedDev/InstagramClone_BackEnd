// auth.middleware.js
import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';

export const verifyToken = async (req, res, next) => {
  try {
    // Kiểm tra token từ nhiều nguồn (ưu tiên theo thứ tự)
    let token;

    // 1. Kiểm tra từ cookie (phương thức ưu tiên)
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    // 2. Kiểm tra từ Authorization header
    else if (req.headers.authorization) {
      const authHeader = req.headers.authorization;
      // Đảm bảo format Bearer token
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else {
        token = authHeader; // Trường hợp gửi token trực tiếp không có prefix
      }
    }

    // 3. Kiểm tra từ query params (ít dùng, chỉ cho một số API đặc biệt)
    else if (req.query && req.query.token) {
      token = req.query.token;
    }

    // Nếu không tìm thấy token
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Quyền truy cập bị từ chối. Không tìm thấy token xác thực.'
      });
    }

    // Xác thực JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      // Xử lý các lỗi JWT cụ thể
      if (jwtError.name === 'TokenExpiredError') {
        res.clearCookie('token', {
          httpOnly: true,
          secure: true, // Luôn true để hoạt động với HTTPS
          sameSite: 'none',  // Cho phép cookie hoạt động cross-domain
          path: '/'
        });
        return res.status(401).json({
          success: false,
          message: 'Token đã hết hạn. Vui lòng đăng nhập lại.'
        });
      } else if (jwtError.name === 'JsonWebTokenError') {
        res.clearCookie('token', {
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          path: '/'
        });
        return res.status(401).json({
          success: false,
          message: 'Token không hợp lệ.'
        });
      }
      throw jwtError;
    }

    // Kiểm tra user trong database
    const user = await User.findById(decoded.id).select('-password');

    // Nếu không tìm thấy user
    if (!user) {
      res.clearCookie('token', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/'
      });
      return res.status(401).json({
        success: false,
        message: 'Người dùng không tồn tại hoặc đã bị xóa.'
      });
    }

    // Kiểm tra nếu tài khoản bị vô hiệu hóa (tùy vào model của bạn)
    if (user.isDisabled === true) {
      res.clearCookie('token', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/'
      });
      return res.status(403).json({
        success: false,
        message: 'Tài khoản đã bị vô hiệu hóa.'
      });
    }

    // Gán thông tin user vào request để các middleware và controller tiếp theo sử dụng
    req.user = user;

    // Tùy chọn: Ghi log hoặc cập nhật lastActive của user
    // await User.findByIdAndUpdate(user._id, { lastActive: new Date() });

    // Chuyển đến middleware hoặc controller tiếp theo
    next();

  } catch (error) {
    console.error('Lỗi xác thực:', error);

    // Xóa cookie token nếu có lỗi
    res.clearCookie('token', {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/'
    });

    return res.status(500).json({
      success: false,
      message: 'Lỗi xác thực. Vui lòng thử lại sau.'
    });
  }
};

// Middleware kiểm tra role admin
export const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Bạn không có quyền truy cập vào tài nguyên này.'
    });
  }
};