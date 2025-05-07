import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';

export const verifyToken = async (req, res, next) => {
  try {
    // Get token from cookie or auth header
    const token = req.cookies.token ||
      (req.headers.authorization && req.headers.authorization.split(' ')[1]);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Try to verify token
    try {
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
      // Handle specific JWT errors
      if (error.name === 'TokenExpiredError') {
        res.clearCookie('token', {
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          path: '/'
        });
        return res.status(401).json({
          success: false,
          message: 'Token expired. Please login again.'
        });
      }

      // Handle other token errors
      res.clearCookie('token', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/'
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.clearCookie('token', {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/'
    });
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};