import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import passport from 'passport';

export const verifyToken = async (req, res, next) => {
  try {
    // Tìm token từ nhiều nguồn khác nhau
    let token = null;

    // 1. Kiểm tra trong cookie (cách thông thường)
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    // 2. Kiểm tra trong Authorization header (Bearer token)
    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    // 3. Kiểm tra trong custom header (cho WebKit browsers)
    if (!token && req.headers['x-access-token']) {
      token = req.headers['x-access-token'];
    }

    // 4. Kiểm tra trong query params (không khuyến khích nhưng là phương án dự phòng)
    if (!token && req.query && req.query.token) {
      token = req.query.token;
    }

    // Nếu không tìm thấy token từ bất kỳ nguồn nào
    if (!token) {
      // Nếu đây là yêu cầu từ WebKit browser và là lần đầu tiên, tạo token mới
      const userAgent = req.headers['user-agent'] || '';
      const isWebKit = userAgent.includes('Safari') &&
        (userAgent.includes('iPhone') ||
          userAgent.includes('iPad') ||
          userAgent.includes('Mac'));

      if (isWebKit && req.headers['x-webkit-initial-request'] === 'true') {
        // Tạo một token tạm thời và gửi lại cho client
        // Lưu ý: Token này sẽ có thời gian ngắn và quyền hạn giới hạn
        const tempToken = jwt.sign(
          { temporary: true, timestamp: Date.now() },
          process.env.JWT_SECRET,
          { expiresIn: '5m' }
        );

        return res.status(203).json({
          success: true,
          message: 'WebKit detected. Use this token in headers.',
          token: tempToken,
          instructions: 'Please include this token in your next request using the X-Access-Token header'
        });
      }

      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Xác thực token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Kiểm tra xem đây có phải là token tạm thời không
    if (decoded.temporary) {
      return res.status(401).json({
        success: false,
        message: 'Cannot use temporary token for authentication. Please login properly.'
      });
    }

    // Xác minh user vẫn tồn tại trong database
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Gán user vào request và gọi next middleware
    req.user = user;

    // Nếu token không được tìm thấy trong cookie (có thể do WebKit),
    // thêm token vào cookie nếu có thể và gửi trong response header
    if (!req.cookies.token && !decoded.temporary) {
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax', // Thử sameSite Lax thay vì Strict
        maxAge: 24 * 60 * 60 * 1000 // 24 giờ
      });

      // Thêm token vào header để client có thể lưu trữ
      res.setHeader('X-Refresh-Token', token);
    }

    next();
  } catch (error) {
    console.error('Token verification error:', error);
    res.clearCookie('token');
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

export const authenticateJWT = passport.authenticate('jwt', { session: false });

