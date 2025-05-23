import Message from '../models/messenger.model.js';
import User from '../models/user.model.js';
import { getIO } from '../middlewares/socket.middleware.js';

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

// // Lấy danh sách ID tất cả user (để nhắn tin với bất kỳ ai)
// export const getUserMessages = async (req, res) => {
//   try {
//     // Lấy tất cả user trong hệ thống (trừ chính mình)
//     const userId = req.user._id.toString();

//     const users = await User.find({ _id: { $ne: userId } })
//       .select('_id username profilePicture checkMark');

//     // Đảm bảo luôn trả về checkMark true/false
//     const usersWithCheckMark = users.map(u => ({
//       _id: u._id,
//       username: u.username,
//       profilePicture: u.profilePicture,
//       checkMark: !!u.checkMark
//     }));

//     return res.status(200).json(usersWithCheckMark);
//   } catch (error) {
//     console.error('Lỗi lấy danh sách user:', error);
//     return res.status(500).json({ message: 'Lỗi server khi lấy danh sách user' });
//   }
// };

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

export const checkUserStatus = async (req, res) => {
  try {
    const { identifier } = req.params;
    const io = getIO();
    const onlineUsers = io.onlineUsers || new Map();

    let user;
    if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
      user = await User.findById(identifier)
        .select('username lastActive lastOnline isOnline');
    } else {
      user = await User.findOne({ username: identifier })
        .select('username lastActive lastOnline isOnline');
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }

    const isOnline = onlineUsers.has(user._id.toString());

    // Nếu user offline và lastOnline là null, cập nhật lastOnline bằng lastActive
    if (!isOnline && !user.lastOnline && user.lastActive) {
      await User.findByIdAndUpdate(user._id, {
        lastOnline: user.lastActive
      });
      user.lastOnline = user.lastActive;
    }

    return res.status(200).json({
      success: true,
      userId: user._id,
      username: user.username,
      status: isOnline ? 'online' : 'offline',
      lastActive: user.lastActive || new Date(),
      lastOnline: user.lastOnline || user.lastActive || new Date()
    });
  } catch (error) {
    console.error('Lỗi kiểm tra trạng thái:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi kiểm tra trạng thái online'
    });
  }
};

// Cập nhật getUserMessages để trả về thêm thông tin thời gian
export const getUserMessages = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const io = getIO();
    const onlineUsers = io.onlineUsers || new Map();

    const users = await User.find({ _id: { $ne: userId } })
      .select('_id username profilePicture checkMark lastActive lastOnline');

    const usersWithStatus = users.map(u => ({
      _id: u._id,
      username: u.username,
      profilePicture: u.profilePicture,
      checkMark: !!u.checkMark,
      isOnline: onlineUsers.has(u._id.toString()),
      lastActive: u.lastActive,
      lastOnline: u.lastOnline
    }));

    return res.status(200).json(usersWithStatus);
  } catch (error) {
    console.error('Lỗi lấy danh sách user:', error);
    return res.status(500).json({ message: 'Lỗi server khi lấy danh sách user' });
  }
};

// Thêm controller mới
export const getRecentChats = async (req, res) => {
  try {
    const userId = req.user._id;
    const io = getIO();
    const onlineUsers = io.onlineUsers || new Map();

    // Lấy tin nhắn mới nhất cho mỗi cuộc trò chuyện
    const recentMessages = await Message.aggregate([
      {
        $match: {
          $or: [
            { senderId: userId },
            { receiverId: userId }
          ]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: {
            $cond: {
              if: { $eq: ["$senderId", userId] },
              then: "$receiverId",
              else: "$senderId"
            }
          },
          messageId: { $first: "$_id" },
          lastMessage: { $first: "$message" },
          senderId: { $first: "$senderId" },
          createdAt: { $first: "$createdAt" },
          isRead: { $first: "$isRead" }
        }
      }
    ]);

    // Lấy thông tin user cho mỗi cuộc trò chuyện
    const chatList = await Promise.all(
      recentMessages.map(async (chat) => {
        const otherUser = await User.findById(chat._id)
          .select('username profilePicture checkMark lastActive lastOnline');

        if (!otherUser) return null;

        return {
          user: {
            _id: otherUser._id,
            username: otherUser.username,
            profilePicture: otherUser.profilePicture,
            checkMark: !!otherUser.checkMark,
            isOnline: onlineUsers.has(otherUser._id.toString()),
            lastActive: otherUser.lastActive,
            lastOnline: otherUser.lastOnline
          },
          lastMessage: {
            _id: chat.messageId,
            message: chat.lastMessage,
            isOwnMessage: chat.senderId.equals(userId),
            createdAt: chat.createdAt,
            isRead: chat.isRead
          }
        };
      })
    );

    // Lọc bỏ các null và sắp xếp theo thời gian tin nhắn mới nhất
    const filteredChats = chatList
      .filter(chat => chat !== null)
      .sort((a, b) => b.lastMessage.createdAt - a.lastMessage.createdAt);

    return res.status(200).json(filteredChats);
  } catch (error) {
    console.error('Lỗi khi lấy danh sách chat gần đây:', error);
    return res.status(500).json({
      message: 'Lỗi server khi lấy danh sách chat gần đây'
    });
  }
};

// Thêm controller mới để đánh dấu tin nhắn đã đọc
export const markMessagesAsRead = async (req, res) => {
  try {
    const { messageIds, senderId } = req.body;
    const receiverId = req.user._id;

    if (!messageIds || !Array.isArray(messageIds) || !senderId) {
      return res.status(400).json({
        message: 'messageIds (array) và senderId là bắt buộc'
      });
    }

    // Cập nhật trạng thái đã đọc cho các tin nhắn
    await Message.updateMany(
      {
        _id: { $in: messageIds },
        senderId: senderId,
        receiverId: receiverId
      },
      { isRead: true }
    );

    const io = getIO();

    // Lấy thông tin user để gửi về
    const receiver = await User.findById(receiverId)
      .select('username profilePicture checkMark lastActive lastOnline');

    // Tạo object chứa thông tin cập nhật
    const updateData = {
      user: {
        _id: receiver._id,
        username: receiver.username,
        profilePicture: receiver.profilePicture,
        checkMark: !!receiver.checkMark,
        isOnline: io.onlineUsers.has(receiver._id.toString()),
        lastActive: receiver.lastActive,
        lastOnline: receiver.lastOnline
      },
      messages: messageIds.map(id => ({
        messageId: id,
        isRead: true
      }))
    };

    // Emit cho người gửi tin nhắn
    io.to(senderId.toString()).emit('messagesStatusUpdate', updateData);

    // Emit cho người nhận tin nhắn
    io.to(receiverId.toString()).emit('messagesStatusUpdate', updateData);

    // Emit cập nhật trạng thái trong recent chats
    io.to(senderId.toString()).emit('updateRecentChat', {
      userId: receiverId,
      lastMessageId: messageIds[messageIds.length - 1],
      isRead: true
    });

    return res.status(200).json({
      success: true,
      message: 'Đã cập nhật trạng thái đọc tin nhắn'
    });

  } catch (error) {
    console.error('Lỗi khi đánh dấu tin nhắn đã đọc:', error);
    return res.status(500).json({
      message: 'Lỗi server khi đánh dấu tin nhắn đã đọc'
    });
  }
};