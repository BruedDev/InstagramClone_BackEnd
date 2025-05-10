import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import passport from 'passport';

export const verifyToken = async (req, res, next) => {
  try {
    let token = req.cookies.token;

    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
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
    res.clearCookie('token');
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

export const authenticateJWT = passport.authenticate('jwt', { session: false });

// Check if user is authenticated using Passport
export const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Unauthorized: Please login first' });
};

// Check if user is NOT authenticated (for login/register pages)
export const isNotAuthenticated = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return next();
  }
  res.status(403).json({ message: 'Already logged in' });
};

// Optional: Add role-based authentication if needed
export const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  res.status(403).json({ message: 'Forbidden: Admin access required' });
};