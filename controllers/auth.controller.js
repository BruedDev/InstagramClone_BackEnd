import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import crypto from 'crypto';

export const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp đầy đủ thông tin'
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
        message: 'Tài khoản hoặc mật khẩu không chính xác'
      });
    }

    // Tạo JWT token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Cài đặt cookie bảo mật
    const cookieOptions = {
      httpOnly: true,       // Không thể truy cập từ JavaScript FE
      secure: true,         // Yêu cầu HTTPS
      sameSite: 'None',     // Cho phép cross-site
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 ngày
      path: '/'             // Toàn bộ domain đều nhận cookie
    };

    // Set cookie cho trình duyệt
    res.cookie('token', token, cookieOptions);

    // Trả về dữ liệu user và token để dùng cho fallback nếu cookie không hoạt động
    res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công',
      token,
      user: {
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        profilePicture: user.profilePicture,
        bio: user.bio,
        followers: user.followers,
        following: user.following,
        isPrivate: user.isPrivate,
        authType: user.authType,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    console.error('Lỗi đăng nhập:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server'
    });
  }
};

export const register = async (req, res) => {
  try {
    const { username, fullName, email, phoneNumber, password } = req.body;

    // Validate required fields
    if (!username || !fullName || !password || (!email && !phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền đầy đủ thông tin bắt buộc'
      });
    }

    // Check if user already exists with username
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({
        success: false,
        message: 'Tên người dùng này đã được sử dụng'
      });
    }

    // Check if user already exists with email (if provided)
    if (email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: 'Email này đã được sử dụng'
        });
      }
    }

    // Check if user already exists with phone number (if provided)
    if (phoneNumber) {
      const existingPhone = await User.findOne({ phoneNumber });
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message: 'Số điện thoại này đã được sử dụng'
        });
      }
    }

    // Create new user
    const newUser = new User({
      username,
      fullName,
      email,
      phoneNumber,
      password, // Lưu ý: Password sẽ được hash trong schema thông qua pre-save middleware
      authType: 'local'
    });

    // Lưu user vào database
    await newUser.save();

    // Return response
    res.status(201).json({
      success: true,
      message: 'Đăng ký thành công',
      user: {
        id: newUser._id,
        username: newUser.username,
        fullName: newUser.fullName,
        email: newUser.email,
        phoneNumber: newUser.phoneNumber,
        profilePicture: newUser.profilePicture,
        bio: newUser.bio,
        followers: newUser.followers,
        following: newUser.following,
        isPrivate: newUser.isPrivate,
        authType: newUser.authType,
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt
      }
    });
  } catch (error) {
    console.error('Lỗi đăng ký:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ'
    });
  }
};

export const logout = async (req, res) => {
  try {
    res.clearCookie('token', {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
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

export const facebookCallback = (req, res) => {
  try {
    // Lấy thông tin user từ req.user (đã được Passport xác thực)
    const user = req.user;

    // Tạo JWT token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Cài đặt cookie bảo mật
    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/'
    };

    // Set cookie cho trình duyệt
    res.cookie('token', token, cookieOptions);

    // Chuyển hướng về frontend với token
    // Frontend cần xử lý route này để lấy token và lưu trữ
    const redirectUrl = `${process.env.FRONTEND_URL || 'https://instagram-clone-seven-sable.vercel.app/'}/accounts/login/?token=${token}`;
    return res.redirect(redirectUrl);
  } catch (error) {
    console.error('Facebook callback error:', error);
    // Chuyển hướng về trang đăng nhập với thông báo lỗi
    return res.redirect(`${process.env.FRONTEND_URL || 'https://instagram-clone-seven-sable.vercel.app/'}/accounts/login?error=auth_failed`);
  }
};

export const facebookLogin = async (req, res) => {
  try {
    const { accessToken, userID, name, email } = req.body;

    if (!accessToken || !userID) {
      return res.status(400).json({
        success: false,
        message: 'Missing required Facebook authentication data'
      });
    }

    // ✅ TÍNH appsecret_proof
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    const appSecretProof = crypto
      .createHmac('sha256', appSecret)
      .update(accessToken)
      .digest('hex');

    // ✅ GỌI GRAPH API CÓ appsecret_proof
    const fbRes = await fetch(
      `https://graph.facebook.com/me?access_token=${accessToken}&fields=id&appsecret_proof=${appSecretProof}`
    );
    const fbData = await fbRes.json();

    if (!fbData || fbData.id !== userID) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Facebook token or appsecret_proof'
      });
    }

    // ✅ Tiếp tục như cũ
    let user = await User.findOne({ facebookId: userID });

    if (!user) {
      if (email) {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          existingUser.facebookId = userID;
          existingUser.authType = 'facebook';
          await existingUser.save();
          user = existingUser;
        }
      }

      if (!user) {
        const baseUsername = name.toLowerCase().replace(/\s+/g, '.') || 'facebook.user';
        let username = baseUsername;
        let counter = 1;

        while (await User.findOne({ username })) {
          username = `${baseUsername}.${counter}`;
          counter++;
        }

        const password = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10);

        user = new User({
          username,
          fullName: name,
          email: email || null,
          password,
          facebookId: userID,
          authType: 'facebook',
          profilePicture: `https://graph.facebook.com/${userID}/picture?type=large`,
        });

        await user.save();
      }
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    };

    res.cookie('token', token, cookieOptions);

    res.status(200).json({
      success: true,
      message: 'Đăng nhập bằng Facebook thành công',
      token,
      user: {
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        profilePicture: user.profilePicture,
        bio: user.bio,
        followers: user.followers,
        following: user.following,
        isPrivate: user.isPrivate,
        authType: user.authType,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('Facebook authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed',
      error: error.message
    });
  }
};
