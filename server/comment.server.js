import Comment from '../models/comment.model.js';
import { getIO } from '../middlewares/socket.middleware.js';

// Helper function để populate comment data
const populateCommentData = async (comment) => {
  return await Comment.findById(comment._id)
    .populate('author', 'username avatar fullName') // Populate thông tin cần thiết của author
    .populate('post', '_id') // Chỉ lấy ID của post
    .populate('reels', '_id') // Chỉ lấy ID của reel
    .exec();
};

// Helper function để emit socket event
const emitSocketEvent = async (savedComment, eventType = 'newComment') => {
  try {
    const io = getIO();
    if (!io) {
      console.warn('Socket.io instance not available');
      return;
    }

    // Populate data trước khi emit
    const populatedComment = await populateCommentData(savedComment);

    let roomName;
    if (populatedComment.post) {
      roomName = `post_${populatedComment.post._id.toString()}`;
    } else if (populatedComment.reels) {
      roomName = `reel_${populatedComment.reels._id.toString()}`;
    }

    if (roomName) {
      const eventData = {
        comment: populatedComment,
        timestamp: new Date().toISOString()
      };

      // Thêm parentId nếu là reply
      if (populatedComment.parentId) {
        eventData.parentId = populatedComment.parentId.toString();
      }

      io.to(roomName).emit(eventType, eventData);
      console.log(`Emitted ${eventType} to room: ${roomName}`);
    }
  } catch (error) {
    console.error('Error emitting socket event:', error);
  }
};

// Hàm tạo comment mới cho Post
export const createCommentForPost = async (authorId, postId, text) => {
  try {
    const newCommentData = {
      text: text.trim(),
      author: authorId,
      post: postId,
      parentId: null,
    };

    const savedComment = await Comment.create(newCommentData);

    if (savedComment) {
      // Emit socket event
      await emitSocketEvent(savedComment, 'newComment');
    }

    return savedComment;
  } catch (error) {
    console.error('Error creating comment for post:', error);
    throw error;
  }
};

// Hàm tạo comment mới cho Reel
export const createCommentForReel = async (authorId, reelId, text) => {
  try {
    const newCommentData = {
      text: text.trim(),
      author: authorId,
      reels: reelId,
      parentId: null,
    };

    const savedComment = await Comment.create(newCommentData);

    if (savedComment) {
      // Emit socket event
      await emitSocketEvent(savedComment, 'newComment');
    }

    return savedComment;
  } catch (error) {
    console.error('Error creating comment for reel:', error);
    throw error;
  }
};

// Hàm tạo reply cho comment
export const createReplyForComment = async (authorId, parentId, text, associatedItemId, itemType) => {
  try {
    // Validate itemType
    if (!['post', 'reel'].includes(itemType)) {
      throw new Error('Invalid itemType. Must be "post" or "reel"');
    }

    const replyData = {
      text: text.trim(),
      author: authorId,
      parentId: parentId,
    };

    // Set associated item based on type
    if (itemType === 'post') {
      replyData.post = associatedItemId;
    } else if (itemType === 'reel') {
      replyData.reels = associatedItemId;
    }

    const savedReply = await Comment.create(replyData);

    if (savedReply) {
      // Emit socket event với event type là 'newReply'
      await emitSocketEvent(savedReply, 'newReply');
    }

    return savedReply;
  } catch (error) {
    console.error('Error creating reply for comment:', error);
    throw error;
  }
};

// Hàm để delete comment (bonus)
export const deleteComment = async (commentId, userId) => {
  try {
    const comment = await Comment.findById(commentId);

    if (!comment) {
      throw new Error('Comment not found');
    }

    // Check if user is author of the comment
    if (comment.author.toString() !== userId.toString()) {
      throw new Error('Unauthorized to delete this comment');
    }

    await Comment.findByIdAndDelete(commentId);

    // Emit delete event
    const io = getIO();
    if (io) {
      let roomName;
      if (comment.post) {
        roomName = `post_${comment.post.toString()}`;
      } else if (comment.reels) {
        roomName = `reel_${comment.reels.toString()}`;
      }

      if (roomName) {
        io.to(roomName).emit('commentDeleted', {
          commentId: commentId,
          parentId: comment.parentId?.toString() || null,
          timestamp: new Date().toISOString()
        });
      }
    }

    return true;
  } catch (error) {
    console.error('Error deleting comment:', error);
    throw error;
  }
};

// Hàm để update comment (bonus)
export const updateComment = async (commentId, userId, newText) => {
  try {
    const comment = await Comment.findById(commentId);

    if (!comment) {
      throw new Error('Comment not found');
    }

    // Check if user is author of the comment
    if (comment.author.toString() !== userId.toString()) {
      throw new Error('Unauthorized to update this comment');
    }

    const updatedComment = await Comment.findByIdAndUpdate(
      commentId,
      {
        text: newText.trim(),
        updatedAt: new Date()
      },
      { new: true }
    );

    if (updatedComment) {
      // Emit update event
      await emitSocketEvent(updatedComment, 'commentUpdated');
    }

    return updatedComment;
  } catch (error) {
    console.error('Error updating comment:', error);
    throw error;
  }
};