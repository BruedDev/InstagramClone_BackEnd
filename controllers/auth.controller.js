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

    // Tạo temporary token với thời gian hết hạn ngắn để dùng cho bước xác thực tiếp theo
    const temporaryToken = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '5m' } // Token chỉ có hiệu lực trong 5 phút
    );

    // Trả về thông tin cơ bản và temporary token cho frontend
    res.status(200).json({
      success: true,
      message: 'Initial login successful, proceed to authentication check',
      temporaryToken: temporaryToken,
      userId: user._id
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

export const checkAuth = async (req, res) => {
  try {
    // req.user đã được đặt bởi middleware verifyToken
    const user = await User.findById(req.user.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Tạo token chính thức với thời hạn dài hơn
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Set cookie options - SameSite phải là 'None' để cookie hoạt động cross-domain
    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/'
    };

    // Set cookie
    res.cookie('token', token, cookieOptions);

    // Trả về thông tin đầy đủ và token chính thức
    res.status(200).json({
      success: true,
      message: 'Authentication successful',
      token: token,
      user: {
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        profilePicture: user.profilePicture
      }
    });
  } catch (error) {
    console.error('Auth check error:', error);
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
      secure: true,
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