import Comment from '../models/comment.model.js';
import User from '../models/user.model.js';
import Post from '../models/post.model.js';
import { getIO } from '../middlewares/socket.middleware.js';
import {
  generateRandomUser,
  generateRandomComment,
  generateNestedComments,
  generateBuffedMetrics
} from '../helper/buffAdmin.js';

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
      await emitSocketEvent(savedComment, 'comment:created');
      // ĐẢM BẢO emit lại danh sách comment mới nhất
      await emitCommentsListForItem(postId, 'post', 100);
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
      await emitSocketEvent(savedComment, 'comment:created');
      await emitCommentsListForItem(reelId, 'reel', 100);
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
      await emitSocketEvent(savedReply, 'comment:created');
      await emitCommentsListForItem(associatedItemId, itemType, 100);
    }

    return savedReply;
  } catch (error) {
    console.error('Error creating reply for comment:', error);
    throw error;
  }
};

// Helper lấy danh sách comment cho một item (post/reel)
export const getCommentsListForItem = async (itemId, itemType, limit = 10, loggedInUserId = null) => {
  const mappedType = itemType === 'post' ? 'post' :
    itemType === 'reel' ? 'reels' :
      itemType === 'video' ? 'video' : 'post';

  // Get all real users from MongoDB for prioritization
  const allUsers = await User.find({}).select('_id').lean();
  const realUserIds = new Set(allUsers.map(user => user._id.toString()));

  let isBuffedItem = false;
  if (mappedType === 'post') {
    const post = await Post.findById(itemId)
      .populate('author', 'username')
      .lean();
    isBuffedItem = post?.author?.username === 'vanloc19_6';
  }

  let comments = [];
  let metrics = {
    totalComments: 0,
    totalLikes: 0,
    hasMore: false
  };

  if (isBuffedItem) {
    // Generate buffed comments
    const userPool = Array.from({ length: 100 }, (_, i) => generateRandomUser(i));
    const mainCommentsCount = Math.floor(Math.random() * 200) + 300;
    const buffedMetrics = generateBuffedMetrics();

    const randomComments = Array.from({ length: mainCommentsCount }, (_, index) => {
      const comment = generateRandomComment(itemId, index, userPool);
      comment.replies = generateNestedComments(itemId, comment, 0, userPool);
      return comment;
    });

    let totalLikes = 0;
    let totalReplies = 0;

    // Get real comments from MongoDB
    const realComments = await Comment.find({ [mappedType]: itemId })
      .populate('author', 'username profilePicture fullname isVerified')
      .lean();

    // Build replies for real comments
    const realCommentMap = new Map();
    realComments.forEach(c => {
      c.likeCount = c.likes?.length || 0;
      c.replies = [];
      realCommentMap.set(c._id.toString(), c);
    });
    realComments.forEach(c => {
      if (c.parentId) {
        const parent = realCommentMap.get(c.parentId?.toString());
        if (parent) {
          parent.replies.push(c);
        }
      }
    });
    // Only top-level real comments
    const processedRealComments = realComments
      .filter(c => !c.parentId)
      .map(comment => ({
        ...comment,
        isReal: true,
        likeCount: comment.likes?.length || 0
      }));

    // Process buffed comments
    randomComments.forEach(comment => {
      totalLikes += comment.likes;
      totalReplies += (comment.replies ? comment.replies.length : 0);
    });

    // Split comments into three groups: logged-in user, real users, and buffed
    let loggedInUserComments = [];
    let realUserComments = [];
    let buffedUserComments = [];

    [...processedRealComments, ...randomComments].forEach(comment => {
      if (comment.isReal && comment.author?._id?.toString() === loggedInUserId) {
        loggedInUserComments.push(comment);
      } else if (comment.isReal && realUserIds.has(comment.author?._id?.toString())) {
        realUserComments.push(comment);
      } else {
        buffedUserComments.push(comment);
      }
    });

    // Sort each group by engagement
    const sortByEngagement = (a, b) => {
      const aEngagement = (a.likes || a.likeCount || 0) + (a.replies?.length || 0);
      const bEngagement = (b.likes || b.likeCount || 0) + (b.replies?.length || 0);
      return bEngagement - aEngagement;
    };

    loggedInUserComments.sort(sortByEngagement);
    realUserComments.sort(sortByEngagement);
    buffedUserComments.sort(sortByEngagement);

    // Combine all comments maintaining priority order
    const allComments = [
      ...loggedInUserComments,
      ...realUserComments,
      ...buffedUserComments
    ];

    comments = allComments.slice(0, limit);

    metrics = {
      totalComments: mainCommentsCount + processedRealComments.length,
      totalReplies: totalReplies + realComments.filter(c => c.parentId).length,
      totalLikes: totalLikes,
      buffedComments: buffedMetrics.comments,
      buffedReplies: buffedMetrics.replies,
      hasMore: allComments.length > limit
    };
  } else {
    // Get all comments for non-buffed items
    const allComments = await Comment.find({ [mappedType]: itemId })
      .populate('author', 'username profilePicture fullname isVerified')
      .lean();

    // Separate top-level comments and replies
    const commentMap = new Map();
    const topLevelComments = [];
    let totalLikes = 0;

    // First pass: Create map of all comments and identify top-level comments
    allComments.forEach(comment => {
      comment.likeCount = comment.likes?.length || 0;
      totalLikes += comment.likeCount;
      comment.replies = [];
      commentMap.set(comment._id.toString(), comment);

      if (!comment.parentId) {
        topLevelComments.push(comment);
      }
    });

    // Second pass: Attach replies to their parent comments
    allComments.forEach(comment => {
      if (comment.parentId) {
        const parentComment = commentMap.get(comment.parentId.toString());
        if (parentComment) {
          parentComment.replies.push(comment);
        }
      }
    });

    // Sort replies by likes within each comment
    topLevelComments.forEach(comment => {
      if (comment.replies.length > 0) {
        comment.replies.sort((a, b) => b.likeCount - a.likeCount);
      }
    });

    // Split comments into three groups
    let loggedInUserComments = [];
    let realUserComments = [];
    let otherComments = [];

    topLevelComments.forEach(comment => {
      if (comment.author?._id?.toString() === loggedInUserId) {
        loggedInUserComments.push(comment);
      } else if (realUserIds.has(comment.author?._id?.toString())) {
        realUserComments.push(comment);
      } else {
        otherComments.push(comment);
      }
    });

    // Sort each group by creation date
    const sortByDate = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);
    loggedInUserComments.sort(sortByDate);
    realUserComments.sort(sortByDate);
    otherComments.sort(sortByDate);

    // Combine with priority order
    comments = [
      ...loggedInUserComments,
      ...realUserComments,
      ...otherComments
    ].slice(0, limit);

    // Calculate total replies
    const totalReplies = allComments.filter(comment => comment.parentId).length;

    metrics = {
      totalComments: topLevelComments.length,
      totalReplies: totalReplies,
      totalLikes: totalLikes,
      hasMore: topLevelComments.length > limit
    };
  }

  // Add ownership flags
  if (isBuffedItem) {
    // Add ownership flags (buffed)
    const ensureRepliesArray = (comment) => ({
      ...comment,
      replies: Array.isArray(comment.replies) ? comment.replies.map(ensureRepliesArray) : [],
      isOwnComment: comment.author?._id?.toString() === loggedInUserId
    });
    const commentsWithOwnership = comments.map(ensureRepliesArray);
    return {
      comments: commentsWithOwnership,
      metrics
    };
  } else {
    // Add ownership flags (real)
    const addOwnership = (comment) => ({
      ...comment,
      replies: Array.isArray(comment.replies) ? comment.replies.map(addOwnership) : [],
      isOwnComment: comment.author?._id?.toString() === loggedInUserId
    });
    const commentsWithOwnership = comments.map(addOwnership);
    return {
      comments: commentsWithOwnership,
      metrics
    };
  }
};

// Emit toàn bộ danh sách comment về room
export const emitCommentsListForItem = async (itemId, itemType, limit = 10, loggedInUserId = null) => {
  try {
    const io = getIO();
    if (!io) return;
    const { comments, metrics } = await getCommentsListForItem(itemId, itemType, limit, loggedInUserId);
    const roomName = `${itemType}_${itemId}`;
    io.to(roomName).emit('comments:updated', {
      comments,
      metrics,
      itemId,
      itemType
    });
  } catch (error) {
    console.error('Error emitting comments list:', error);
  }
};

