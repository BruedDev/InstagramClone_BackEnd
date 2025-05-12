import User from '../models/user.model.js';

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