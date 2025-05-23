import { Server as SocketIOServer } from 'socket.io';
import { handleMessages } from '../server/message.service.js';
import { handleCall } from '../server/call.service.js';
import { createCommentForPost, createCommentForReel } from '../server/comment.server.js';
import User from '../models/user.model.js';

let io;
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
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['Set-Cookie', 'Authorization'],
    },
  });

  io.onlineUsers = onlineUsers;

  io.on('connection', (socket) => {
    socket.on('userOnline', async (userId) => {
      if (!userId) return;
      let userSockets = onlineUsers.get(userId) || new Set();
      userSockets.add(socket.id);
      onlineUsers.set(userId, userSockets);
      socket.join(userId.toString());

      // Cập nhật trạng thái và thời gian online trong DB
      const now = new Date();
      await User.findByIdAndUpdate(userId, {
        isOnline: true,
        lastActive: now,
        lastOnline: now
      });

      socket.broadcast.emit('userStatusChange', {
        userId,
        status: 'online',
        lastActive: now,
        lastOnline: now
      });
    });
    // Bổ sung xử lý comment realtime
    socket.on('comment:typing', ({ itemId, itemType, user }) => {
      const roomName = `${itemType}_${itemId}`;
      socket.to(roomName).emit('comment:typing', {
        itemId,
        user: {
          id: user.id,
          username: user.username,
          profilePicture: user.profilePicture
        }
      });
    });

    socket.on('comment:stopTyping', ({ itemId, itemType, userId }) => {
      const roomName = `${itemType}_${itemId}`;
      socket.to(roomName).emit('comment:stopTyping', {
        itemId,
        userId
      });
    });

    // Xử lý reaction cho comment
    socket.on('comment:react', ({ commentId, reaction, user }) => {
      // Phát sự kiện tới tất cả client trong room của post/reel chứa comment
      socket.broadcast.emit('comment:reacted', {
        commentId,
        reaction,
        user: {
          id: user.id,
          username: user.username,
          profilePicture: user.profilePicture
        }
      });
    });

    // Xử lý xóa comment
    socket.on('comment:delete', ({ commentId, itemId, itemType }) => {
      const roomName = `${itemType}_${itemId}`;
      socket.to(roomName).emit('comment:deleted', {
        commentId,
        itemId
      });
    });

    // Xử lý edit comment
    socket.on('comment:edit', ({ commentId, newText, itemId, itemType }) => {
      const roomName = `${itemType}_${itemId}`;
      socket.to(roomName).emit('comment:edited', {
        commentId,
        newText,
        itemId
      });
    });

    // Thêm xử lý tạo comment mới
    socket.on('comment:create', async ({ authorId, itemId, itemType, text }) => {
      try {
        let savedComment;

        if (itemType === 'post') {
          savedComment = await createCommentForPost(authorId, itemId, text);
        } else if (itemType === 'reel') {
          savedComment = await createCommentForReel(authorId, itemId, text);
        }

        if (savedComment) {
          const roomName = `${itemType}_${itemId}`;
          socket.to(roomName).emit('comment:created', {
            itemId,
            itemType,
            comment: savedComment
          });
        }
      } catch (error) {
        console.error('Error creating comment:', error);
        socket.emit('comment:error', {
          message: 'Không thể tạo bình luận, vui lòng thử lại'
        });
      }
    });

    handleMessages(socket, io, onlineUsers);
    handleCall(socket, io, onlineUsers);

    socket.on('disconnect', async () => {
      for (const [userId, socketSet] of onlineUsers.entries()) {
        if (socketSet.has(socket.id)) {
          socketSet.delete(socket.id);
          if (socketSet.size === 0) {
            onlineUsers.delete(userId);

            // Cập nhật trạng thái và thời gian offline trong DB
            const now = new Date();
            await User.findByIdAndUpdate(userId, {
              isOnline: false,
              lastActive: now,
              lastOnline: now
            });

            socket.broadcast.emit('userStatusChange', {
              userId,
              status: 'offline',
              lastActive: now,
              lastOnline: now
            });
          } else {
            onlineUsers.set(userId, socketSet);
          }
          break;
        }
      }
    });

    // BỔ SUNG PHẦN QUẢN LÝ ROOM CHO COMMENT REAL-TIME
    socket.on('joinPostRoom', (postId) => {
      if (postId) {
        const roomName = `post_${postId}`;
        socket.join(roomName);
      }
    });

    socket.on('leavePostRoom', (postId) => {
      if (postId) {
        const roomName = `post_${postId}`;
        socket.leave(roomName);
      }
    });

    socket.on('joinReelRoom', (reelId) => {
      if (reelId) {
        const roomName = `reel_${reelId}`;
        socket.join(roomName);
      }
    });

    socket.on('leaveReelRoom', (reelId) => {
      if (reelId) {
        const roomName = `reel_${reelId}`;
        socket.leave(roomName);
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