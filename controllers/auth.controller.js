import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import bcrypt from 'bcrypt';

// Thiết lập thông số cho cookie
const setupCookieOptions = (req) => {
  // Xác định môi trường - mặc định giả định là production nếu không được thiết lập
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';

  // Xác định nếu kết nối là HTTPS
  const isSecureConnection = req.secure || req.headers['x-forwarded-proto'] === 'https';

  return {
    httpOnly: true,
    // Chỉ dùng secure=true nếu đang trong production HOẶC kết nối hiện tại là HTTPS
    secure: isProduction || isSecureConnection,
    // Sử dụng sameSite=none chỉ khi có kết nối secure
    sameSite: (isProduction || isSecureConnection) ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // Token có hiệu lực 7 ngày
    path: '/',
  };
};

/**
 * Đăng nhập người dùng
 * @param {Object} req - Request
 * @param {Object} res - Response
 */
export const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    // Kiểm tra dữ liệu đầu vào
    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập thông tin đăng nhập và mật khẩu',
      });
    }

    // Tạo điều kiện tìm kiếm linh hoạt (email, username hoặc phone)
    const searchQuery = {
      $or: [
        { email: identifier },
        { username: identifier },
        { phone: identifier }
      ]
    };

    // Tìm người dùng theo nhiều trường
    const user = await User.findOne(searchQuery);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Thông tin đăng nhập hoặc mật khẩu không chính xác',
      });
    }

    // Kiểm tra mật khẩu
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Thông tin đăng nhập hoặc mật khẩu không chính xác',
      });
    }

    // Tạo JWT token
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        username: user.username,
        role: user.role || 'user',
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Thiết lập cookie options
    const cookieOptions = setupCookieOptions(req);

    // Gửi token qua cookie
    res.cookie('token', token, cookieOptions);

    // Gửi token qua header cho các trường hợp không sử dụng được cookie
    res.setHeader('Authorization', `Bearer ${token}`);

    // Trả về thông tin người dùng (không bao gồm mật khẩu)
    const userResponse = {
      _id: user._id,
      email: user.email,
      username: user.username,
      name: user.name,
      phone: user.phone,
      role: user.role || 'user',
    };

    return res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công',
      user: userResponse,
      token, // Cung cấp token trong response body cho mobile apps
    });
  } catch (error) {
    console.error('Lỗi đăng nhập:', error);
    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi đăng nhập',
      error: error.message,
    });
  }
};

/**
 * Đăng xuất người dùng
 * @param {Object} req - Request
 * @param {Object} res - Response
 */
export const logout = (req, res) => {
  try {
    // Thiết lập cookie options
    const cookieOptions = setupCookieOptions(req);

    // Xóa cookie token
    res.cookie('token', '', {
      ...cookieOptions,
      maxAge: 1, // Hết hạn ngay lập tức
    });

    // Xóa Authorization header
    res.setHeader('Authorization', '');

    return res.status(200).json({
      success: true,
      message: 'Đăng xuất thành công',
    });
  } catch (error) {
    console.error('Lỗi đăng xuất:', error);
    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi đăng xuất',
      error: error.message,
    });
  }
};

/**
 * Kiểm tra trạng thái xác thực
 * @param {Object} req - Request
 * @param {Object} res - Response
 */
export const checkAuth = (req, res) => {
  try {
    // Trả về thông tin người dùng (đã được xác thực từ middleware verifyToken)
    return res.status(200).json({
      success: true,
      message: 'Người dùng đã được xác thực',
      user: req.user,
    });
  } catch (error) {
    console.error('Lỗi kiểm tra xác thực:', error);
    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi kiểm tra xác thực',
      error: error.message,
    });
  }
};