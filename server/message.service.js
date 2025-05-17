import Message from '../models/messenger.model.js';
import User from '../models/user.model.js';

export const handleMessages = (socket, io, onlineUsers) => {
  // Đăng ký socket join phòng theo userId (để gửi tin nhắn riêng)
  socket.on('joinUserRoom', (userId) => {
    if (!userId) return;
    socket.join(userId.toString());
  });

  socket.on('sendMessage', async (data) => {
    /**
     * data = {
     *   senderId,
     *   receiverId,
     *   message,
     *   tempId (thêm)
     * }
     */
    try {
      // Lưu tin nhắn vào DB
      const newMessage = await Message.create({
        senderId: data.senderId,
        receiverId: data.receiverId,
        message: data.message,
      });

      // Lấy thông tin người gửi để gửi về client (username, fullName, checkMark)
      const author = await User.findById(data.senderId).select('username fullName checkMark');

      // Tạo đối tượng gửi lại client
      const response = {
        _id: newMessage._id,
        message: newMessage.message,
        senderId: newMessage.senderId,
        receiverId: newMessage.receiverId,
        createdAt: newMessage.createdAt,
        isRead: newMessage.isRead,
        author,
      };

      // Gửi tin nhắn cho người nhận thông qua phòng
      socket.to(data.receiverId.toString()).emit('receiveMessage', response);

      // Gửi lại cho người gửi để xác nhận
      socket.emit('receiveMessage', response);

      // Gửi thêm sự kiện xác nhận tin nhắn đã được gửi
      socket.emit('messageSent', {
        messageId: newMessage._id,
        tempId: data.tempId,
        status: 'sent'
      });

    } catch (error) {
      console.error('Lỗi khi gửi tin nhắn qua socket:', error);
      socket.emit('errorMessage', {
        tempId: data.tempId,
        message: 'Gửi tin nhắn thất bại',
        retryable: true
      });
    }
  });

  // Thêm: đánh dấu tin nhắn đã đọc
  socket.on('markMessageRead', async (data) => {
    try {
      const { messageId, senderId, receiverId } = data;

      await Message.findByIdAndUpdate(messageId, { isRead: true });

      // Thông báo cho người gửi biết tin nhắn đã được đọc
      io.to(senderId.toString()).emit('messageRead', {
        messageId,
        readBy: receiverId
      });

    } catch (error) {
      console.error('Lỗi khi đánh dấu tin nhắn đã đọc:', error);
    }
  });

  // Thêm: lấy trạng thái online của một người dùng
  socket.on('checkUserStatus', (userId) => {
    const isOnline = onlineUsers.has(userId);
    socket.emit('userStatus', { userId, status: isOnline ? 'online' : 'offline' });
  });
};