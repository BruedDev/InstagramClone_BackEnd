import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';

export const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    const user = await User.findOne({
      $or: [
        { username: identifier },
        { email: identifier },
        { phoneNumber: identifier }
      ]
    });

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Create token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Set cookie options - SameSite phải là 'None' để cookie hoạt động cross-domain
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' || true, // Luôn true trong môi trường dev để hoạt động với HTTPS
      sameSite: 'none',  // Điều này quan trọng để cookie hoạt động cross-domain
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/'
    };

    // Set cookie
    res.cookie('token', token, cookieOptions);

    // Trả về token trong JSON response để frontend có thể sử dụng nếu cookie không hoạt động
    res.status(200).json({
      success: true,
      message: 'Login successful',
      token: token, // Thêm token vào response
      user: {
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        profilePicture: user.profilePicture
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export const logout = async (req, res) => {
  try {
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' || true,
      sameSite: 'none',
      path: '/'
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export const checkAuth = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};