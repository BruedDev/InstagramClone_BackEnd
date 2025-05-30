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

// Phiên bản cải thiện của getMessages - lấy toàn bộ cuộc hội thoại
export const getMessages = async (req, res) => {
  try {
    const userId1 = req.user._id.toString();
    const userId2 = req.params.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50; // Tăng limit lên 50
    const loadAll = req.query.loadAll === 'true'; // Tham số để load tất cả

    if (!userId2) {
      return res.status(400).json({ message: 'userId là bắt buộc' });
    }

    let messages;
    let totalMessages = 0;
    let hasMore = false;

    if (loadAll) {
      // Lấy tất cả tin nhắn giữa 2 người
      messages = await Message.find({
        $or: [
          { senderId: userId1, receiverId: userId2 },
          { senderId: userId2, receiverId: userId1 },
        ],
      })
        .populate('senderId', '_id username fullName profilePicture checkMark')
        .populate('receiverId', '_id username fullName profilePicture checkMark')
        .sort({ createdAt: 1 }) // Sắp xếp từ cũ đến mới
        .lean(); // Sử dụng lean() để tăng performance

      totalMessages = messages.length;
    } else {
      // Lấy tin nhắn theo phân trang (cho infinite scroll)
      const skip = (page - 1) * limit;

      // Đếm tổng số tin nhắn
      totalMessages = await Message.countDocuments({
        $or: [
          { senderId: userId1, receiverId: userId2 },
          { senderId: userId2, receiverId: userId1 },
        ],
      });

      messages = await Message.find({
        $or: [
          { senderId: userId1, receiverId: userId2 },
          { senderId: userId2, receiverId: userId1 },
        ],
      })
        .populate('senderId', '_id username fullName profilePicture checkMark')
        .populate('receiverId', '_id username fullName profilePicture checkMark')
        .sort({ createdAt: -1 }) // Mới nhất trước để phân trang
        .skip(skip)
        .limit(limit)
        .lean();

      // Đảo ngược để hiển thị từ cũ đến mới
      messages.reverse();

      // Kiểm tra còn tin nhắn để load không
      hasMore = skip + limit < totalMessages;
    }

    // Đánh dấu tin nhắn từ người khác là đã đọc
    const unreadMessageIds = messages
      .filter(msg =>
        msg.senderId._id.toString() === userId2 &&
        msg.receiverId._id.toString() === userId1 &&
        !msg.isRead
      )
      .map(msg => msg._id);

    if (unreadMessageIds.length > 0) {
      await Message.updateMany(
        { _id: { $in: unreadMessageIds } },
        { isRead: true }
      );

      // Emit socket event để cập nhật trạng thái real-time
      const io = getIO();
      if (io) {
        io.to(userId2).emit('messagesRead', {
          messageIds: unreadMessageIds,
          readBy: userId1
        });
      }
    }

    // Format response data
    const formattedMessages = messages.map(msg => ({
      _id: msg._id,
      senderId: msg.senderId,
      receiverId: msg.receiverId,
      message: msg.message,
      isRead: unreadMessageIds.includes(msg._id.toString()) ? true : msg.isRead,
      createdAt: msg.createdAt,
      updatedAt: msg.updatedAt,
      isOwnMessage: msg.senderId._id.toString() === userId1
    }));

    return res.status(200).json({
      messages: formattedMessages,
      pagination: {
        currentPage: page,
        totalMessages,
        hasMore,
        messagesPerPage: limit
      },
      unreadCount: unreadMessageIds.length
    });

  } catch (error) {
    console.error('Lỗi lấy tin nhắn:', error);
    return res.status(500).json({ message: 'Lỗi server khi lấy tin nhắn' });
  }
};

// Thêm hàm mới để lấy tin nhắn với infinite scroll
export const getMessagesWithPagination = async (req, res) => {
  try {
    const userId1 = req.user._id.toString();
    const userId2 = req.params.userId;
    const before = req.query.before; // timestamp để load tin nhắn trước đó
    const limit = parseInt(req.query.limit) || 20;

    if (!userId2) {
      return res.status(400).json({ message: 'userId là bắt buộc' });
    }

    let query = {
      $or: [
        { senderId: userId1, receiverId: userId2 },
        { senderId: userId2, receiverId: userId1 },
      ],
    };

    // Nếu có before timestamp, chỉ lấy tin nhắn trước thời điểm đó
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .populate('senderId', '_id username fullName profilePicture checkMark')
      .populate('receiverId', '_id username fullName profilePicture checkMark')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // Đảo ngược để hiển thị từ cũ đến mới
    messages.reverse();

    // Kiểm tra còn tin nhắn cũ hơn không
    const oldestMessage = messages.length > 0 ? messages[0] : null;
    const hasMore = oldestMessage ? await Message.exists({
      ...query,
      createdAt: { $lt: oldestMessage.createdAt }
    }) : false;

    return res.status(200).json({
      messages: messages.map(msg => ({
        ...msg,
        isOwnMessage: msg.senderId._id.toString() === userId1
      })),
      hasMore,
      oldestTimestamp: oldestMessage?.createdAt || null
    });

  } catch (error) {
    console.error('Lỗi lấy tin nhắn phân trang:', error);
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
    const Story = (await import('../models/story.model.js')).default;

    const users = await User.find({ _id: { $ne: userId } })
      .select('_id username profilePicture checkMark lastActive lastOnline');

    // Lấy danh sách userId
    const userIds = users.map(u => u._id);
    // Lấy các user có story đang hoạt động
    const stories = await Story.aggregate([
      {
        $match: {
          author: { $in: userIds },
          isArchived: false,
          expiresAt: { $gt: new Date() }
        }
      },
      {
        $group: { _id: '$author' }
      }
    ]);
    const usersWithStory = new Set(stories.map(s => s._id.toString()));

    const usersWithStatus = users.map(u => ({
      _id: u._id,
      username: u.username,
      profilePicture: u.profilePicture,
      checkMark: !!u.checkMark,
      isOnline: onlineUsers.has(u._id.toString()),
      lastActive: u.lastActive,
      lastOnline: u.lastOnline,
      hasStory: usersWithStory.has(u._id.toString())
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