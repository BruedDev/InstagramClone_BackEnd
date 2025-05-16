import User from '../models/user.model.js';
import cloudinary from '../config/cloudinary.config.js';
import { uploadImage } from '../utils/cloudinaryUpload.js';

// Your existing deleteUser function
export const deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;

    // Kiểm tra xem người dùng có tồn tại hay không
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }

    // Kiểm tra quyền xóa (chỉ admin hoặc chính người dùng đó mới có quyền xóa)
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa người dùng này'
      });
    }

    // Xóa người dùng
    await User.findByIdAndDelete(userId);

    // Nếu người dùng đang xóa tài khoản của chính mình, hãy xóa cookie token
    if (req.user.id === userId) {
      res.clearCookie('token', {
        httpOnly: true,
        secure: true,
        sameSite: 'None',
        path: '/'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Đã xóa người dùng thành công'
    });
  } catch (error) {
    console.error('Lỗi khi xóa người dùng:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ'
    });
  }
};

// New function to get user by ID or username
export const getUser = async (req, res) => {
  try {
    const { identifier } = req.params; // identifier can be either ID or username

    // First, try to find by ID (if the identifier is a valid MongoDB ObjectId)
    let user = null;

    // Check if identifier is a valid MongoDB ObjectId
    const isValidObjectId = identifier.match(/^[0-9a-fA-F]{24}$/);

    if (isValidObjectId) {
      user = await User.findById(identifier)
        .select('-password') // Exclude password from the result
        .lean(); // Convert to plain JavaScript object
    }

    // If not found by ID or not a valid ID, try finding by username
    if (!user) {
      user = await User.findOne({ username: identifier })
        .select('-password')
        .lean();
    }

    // Check if user exists
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }

    // ✅ Cấp tích xanh nếu là username cụ thể
    if (user.username === 'vanloc19_6' && !user.checkMark) {
      await User.updateOne({ username: 'vanloc19_6' }, { checkMark: true });
      // Lấy lại user từ DB để đảm bảo checkMark là true và đúng kiểu boolean
      user = await User.findOne({ username: 'vanloc19_6' }).select('-password').lean();
    }

    // Return the user data
    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Lỗi khi lấy thông tin người dùng:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ'
    });
  }
};

// Upload avatar
export const uploadAvatar = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Không có file nào được tải lên' });
    }

    // Upload file lên Cloudinary
    const result = await uploadImage(req.file.path, 'avatars');

    // Cập nhật thông tin người dùng
    const user = await User.findByIdAndUpdate(
      userId,
      {
        profilePicture: result.secure_url,
        profilePicturePublicId: result.public_id,
      },
      { new: true }
    ).select('-password');

    res.status(200).json({
      success: true,
      message: 'Tải ảnh đại diện thành công',
      user,
    });
  } catch (error) {
    console.error('Lỗi khi upload avatar:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

// Xóa avatar
export const deleteAvatar = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    // Nếu có ảnh đại diện thì xóa khỏi Cloudinary
    if (user.profilePicturePublicId) {
      await cloudinary.uploader.destroy(user.profilePicturePublicId);
    }

    // Cập nhật user: xóa avatar và khôi phục ảnh mặc định trong DB
    user.profilePicture = user.schema.path('profilePicture').defaultValue;  // Lấy giá trị mặc định từ schema
    user.profilePicturePublicId = ''; // Cập nhật PublicId về rỗng
    await user.save();

    res.status(200).json({ success: true, message: 'Đã xóa ảnh đại diện' });
  } catch (error) {
    console.error('Lỗi khi xóa avatar:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const updateBio = async (req, res) => {
  try {
    const userId = req.user.id;
    const { bio } = req.body; // bio có thể rỗng hoặc có nội dung

    const user = await User.findByIdAndUpdate(
      userId,
      { bio: bio || '' }, // Nếu không có nội dung thì set rỗng
      { new: true }
    ).select('-password');

    res.status(200).json({
      success: true,
      message: 'Cập nhật bio thành công',
      user,
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật bio:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const suggestUsers = async (req, res) => {
  try {
    const myId = req.user.id;

    let users = await User.find({ _id: { $ne: myId } })
      .select('-password')
      .lean();

    // Đảm bảo checkMark là boolean (true/false)
    users = users.map(u => ({
      ...u,
      checkMark: !!u.checkMark
    }));

    // Ưu tiên người có checkMark lên đầu
    users.sort((a, b) => {
      if (b.checkMark && !a.checkMark) return -1;
      if (a.checkMark && !b.checkMark) return 1;
      return 0;
    });

    res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    console.error('Lỗi khi gợi ý người dùng:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};