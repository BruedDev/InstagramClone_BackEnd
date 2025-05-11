import User from '../models/user.model.js';

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