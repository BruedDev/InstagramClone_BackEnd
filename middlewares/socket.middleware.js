import { Server as SocketIOServer } from 'socket.io';
import { handleMessages } from '../server/message.service.js';
import { handleCall } from '../server/call.service.js';

let io;

// Map lưu trữ userId với danh sách socketId kết nối
const onlineUsers = new Map();

export const initSocket = (server) => {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://instagram-clone-seven-sable.vercel.app',
    process.env.FRONTEND_URL,
  ].filter(Boolean);

  io = new SocketIOServer(server, {
    cors: {
      origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          console.error('Blocked Socket.io CORS origin:', origin);
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['Set-Cookie', 'Authorization'],
    },
  });

  // Gắn onlineUsers vào io để controller truy cập được
  io.onlineUsers = onlineUsers;

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // Khi client gửi event xác nhận userId (gửi ngay sau khi kết nối)
    socket.on('userOnline', (userId) => {
      if (!userId) return;

      let userSockets = onlineUsers.get(userId) || new Set();
      userSockets.add(socket.id);
      onlineUsers.set(userId, userSockets);

      // Join phòng theo userId
      socket.join(userId.toString());

      // Thông báo cho người khác biết user này online
      socket.broadcast.emit('userStatusChange', { userId, status: 'online' });
    });

    // Xử lý tin nhắn và call
    handleMessages(socket, io, onlineUsers);
    handleCall(socket, io, onlineUsers);

    socket.on('disconnect', () => {
      // Xóa socketId khỏi user
      for (const [userId, socketSet] of onlineUsers.entries()) {
        if (socketSet.has(socket.id)) {
          socketSet.delete(socket.id);
          if (socketSet.size === 0) {
            onlineUsers.delete(userId);
            // Thông báo cho người khác biết user này offline
            socket.broadcast.emit('userStatusChange', { userId, status: 'offline' });
          } else {
            onlineUsers.set(userId, socketSet);
          }
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