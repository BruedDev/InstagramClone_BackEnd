import Message from '../models/messenger.model.js';
import User from '../models/user.model.js';

// Gửi tin nhắn (bạn đã viết rồi)
export const sendMessage = async (req, res) => {
  try {
    const { receiverId, message } = req.body;
    const senderId = req.user._id;

    if (!receiverId || !message) {
      return res.status(400).json({ message: 'receiverId và message là bắt buộc' });
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      message,
    });

    const savedMessage = await newMessage.save();

    const author = await User.findById(senderId).select('username fullName checkMark');

    return res.status(201).json({
      message: savedMessage,
      author: author || null,
    });
  } catch (error) {
    console.error('Lỗi gửi tin nhắn:', error);
    return res.status(500).json({ message: 'Lỗi server khi gửi tin nhắn' });
  }
};

// Trong phần getMessages, thêm logic để cập nhật trạng thái đã đọc
export const getMessages = async (req, res) => {
  try {
    const userId1 = req.user._id.toString();
    const userId2 = req.params.userId;
    const limit = parseInt(req.query.limit) || 6; // mặc định 6
    const offset = parseInt(req.query.offset) || 0;

    if (!userId2) {
      return res.status(400).json({ message: 'userId là bắt buộc' });
    }

    const messages = await Message.find({
      $or: [
        { senderId: userId1, receiverId: userId2 },
        { senderId: userId2, receiverId: userId1 },
      ],
    })
      .sort({ createdAt: -1 }) // mới nhất trước
      .skip(offset)
      .limit(limit);

    // Đánh dấu đã đọc
    await Message.updateMany(
      { senderId: userId2, receiverId: userId1, isRead: false },
      { isRead: true }
    );

    messages.reverse(); // trả về thứ tự cũ -> mới

    return res.status(200).json(messages);
  } catch (error) {
    console.error('Lỗi lấy tin nhắn:', error);
    return res.status(500).json({ message: 'Lỗi server khi lấy tin nhắn' });
  }
};

// Lấy danh sách ID tất cả user (để nhắn tin với bất kỳ ai)
export const getUserMessages = async (req, res) => {
  try {
    // Lấy tất cả user trong hệ thống (trừ chính mình)
    const userId = req.user._id.toString();

    const users = await User.find({ _id: { $ne: userId } })
      .select('_id username profilePicture checkMark');

    // Đảm bảo luôn trả về checkMark true/false
    const usersWithCheckMark = users.map(u => ({
      _id: u._id,
      username: u.username,
      profilePicture: u.profilePicture,
      checkMark: !!u.checkMark
    }));

    return res.status(200).json(usersWithCheckMark);
  } catch (error) {
    console.error('Lỗi lấy danh sách user:', error);
    return res.status(500).json({ message: 'Lỗi server khi lấy danh sách user' });
  }
};

// Lấy số lượng tin nhắn chưa đọc
export const getUnreadCount = async (req, res) => {
  try {
    const senderId = req.params.senderId;
    const receiverId = req.query.receiverId;

    if (!senderId || !receiverId) {
      return res.status(400).json({ message: 'Thiếu senderId hoặc receiverId' });
    }

    // Đếm số lượng tin nhắn chưa đọc từ senderId gửi cho receiverId
    const count = await Message.countDocuments({
      senderId,
      receiverId,
      isRead: false
    });

    // Lấy tin nhắn chưa đọc mới nhất từ senderId gửi cho receiverId
    const latestUnread = await Message.findOne({
      senderId,
      receiverId,
      isRead: false
    })
      .sort({ createdAt: -1 })
      .select('message')
      .lean();

    return res.status(200).json({
      unreadCount: count,
      message: latestUnread ? latestUnread.message : null
    });
  } catch (error) {
    console.error('Lỗi khi lấy số tin nhắn chưa đọc:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};