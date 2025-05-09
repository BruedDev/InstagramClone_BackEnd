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
      message: 'Login successful',
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
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
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
      password,
      authType: 'local'
    });

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

export const facebookLogin = async (req, res) => {
  try {
    const { accessToken, userID, name, email } = req.body;

    if (!accessToken || !userID) {
      return res.status(400).json({ message: 'Missing required Facebook authentication data' });
    }

    // Kiểm tra xem có người dùng với Facebook ID này chưa
    let user = await User.findOne({ facebookId: userID });

    if (!user) {
      // Nếu người dùng đã đăng ký bằng email nhưng chưa liên kết Facebook
      if (email) {
        const existingUser = await User.findOne({ email });

        if (existingUser) {
          // Liên kết tài khoản Facebook với tài khoản hiện có
          existingUser.facebookId = userID;
          existingUser.authType = 'facebook';
          await existingUser.save();
          user = existingUser;
        }
      }

      // Nếu không tìm thấy tài khoản, tạo tài khoản mới
      if (!user) {
        // Tạo username duy nhất từ tên Facebook
        const baseUsername = name.toLowerCase().replace(/\s+/g, '.') || 'facebook.user';
        let username = baseUsername;
        let counter = 1;

        // Đảm bảo username không bị trùng
        while (await User.findOne({ username })) {
          username = `${baseUsername}.${counter}`;
          counter++;
        }

        // Tạo mật khẩu ngẫu nhiên an toàn cho tài khoản
        const password = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10);

        // Tạo người dùng mới
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

    // Tạo JWT token
    const token = jwt.sign(
      { userId: user._id },  // Sửa lại để đồng nhất với login/register
      process.env.JWT_SECRET,
      { expiresIn: '30d' }  // Giống như trong login (thời gian hết hạn 30 ngày)
    );

    // Thiết lập cookie giống như ở login và register
    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 ngày
      path: '/',
    };

    res.cookie('token', token, cookieOptions);

    // Trả về thông tin người dùng (không gồm mật khẩu) và token
    const { password, ...userInfo } = user._doc;

    res.status(200).json({
      message: 'Đăng nhập bằng Facebook thành công',
      success: true,
      token, // Trả về token làm fallback cho trường hợp cookie không hoạt động
      user: userInfo,
    });
  } catch (error) {
    console.error('Facebook authentication error:', error);
    res.status(500).json({ message: 'Authentication failed', error: error.message, success: false });
  }
};
