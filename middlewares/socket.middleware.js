import { Server as SocketIOServer } from 'socket.io';
import { handleMessages } from '../server/message.service.js';
import { handleCall } from '../server/call.service.js';
let io;

// Map lưu trữ userId với danh sách socketId kết nối
const onlineUsers = new Map();

export const initSocket = (server) => {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // Khi client gửi event xác nhận userId (ví dụ client gửi ngay sau khi kết nối)
    socket.on('userOnline', (userId) => {
      if (!userId) return;

      // Lấy danh sách socketId hiện tại của user hoặc tạo mới
      let userSockets = onlineUsers.get(userId) || new Set();

      userSockets.add(socket.id);
      onlineUsers.set(userId, userSockets);

      // Thêm: tự động join phòng theo userId
      socket.join(userId.toString());

      // Thêm: thông báo cho người dùng khác biết người này đang online
      socket.broadcast.emit('userStatusChange', { userId, status: 'online' });

      console.log(`👤 User ${userId} connected, total unique online users: ${onlineUsers.size}`);
    });

    // Xử lý tin nhắn (logic tách ra file khác)
    handleMessages(socket, io, onlineUsers);
    handleCall(socket, io, onlineUsers);

    socket.on('disconnect', () => {
      console.log(`❌ Socket disconnected: ${socket.id}`);

      // Tìm userId tương ứng với socket này để xóa socketId đó
      for (const [userId, socketSet] of onlineUsers.entries()) {
        if (socketSet.has(socket.id)) {
          socketSet.delete(socket.id);
          if (socketSet.size === 0) {
            onlineUsers.delete(userId); // Xóa user nếu hết socket kết nối

            // Thêm: thông báo cho người dùng khác biết người này đã offline
            socket.broadcast.emit('userStatusChange', { userId, status: 'offline' });
          } else {
            onlineUsers.set(userId, socketSet);
          }

          console.log(`👤 User ${userId} disconnected one socket, total unique online users: ${onlineUsers.size}`);
          break;
        }
      }
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io chưa được khởi tạo!');
  }
  return io;
};