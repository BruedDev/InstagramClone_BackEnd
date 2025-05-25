// controllers/post.controllers.js

import Post from '../models/post.model.js';
import { uploadImage, uploadVideo } from '../utils/cloudinaryUpload.js';
import User from '../models/user.model.js';
import Comment from '../models/comment.model.js';
import {
  createCommentForPost,
  createCommentForReel,
  createReplyForComment,
} from '../server/comment.server.js';
import {
  generateRandomUser,
  generateRandomComment,
  generateNestedComments,
  generateBuffedMetrics
} from '../helper/buffAdmin.js';

// Đăng bài viết (ảnh hoặc video)
export const createPost = async (req, res) => {
  try {
    const { caption, desc, type } = req.body;
    const authorId = req.user.id;

    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: 'Không có file nào được tải lên' });
    }

    if (!['image', 'video'].includes(type)) {
      return res
        .status(400)
        .json({
          success: false,
          message: 'Loại file không hợp lệ (image hoặc video)',
        });
    }

    let result;
    if (type === 'image') {
      result = await uploadImage(req.file.path, 'posts');
    } else if (type === 'video') {
      result = await uploadVideo(req.file.path, 'posts');
    }

    const newPost = new Post({
      caption,
      desc,
      fileUrl: result.secure_url,
      filePublicId: result.public_id,
      type,
      author: authorId,
    });

    await newPost.save();

    // Thêm ID bài viết vào mảng posts của user
    await User.findByIdAndUpdate(authorId, { $push: { posts: newPost._id } });

    res.status(201).json({
      success: true,
      message: 'Đăng bài viết thành công',
      post: newPost,
    });
  } catch (error) {
    console.error('Lỗi khi tạo bài viết:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const getPostUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { type } = req.query;

    let user;
    if (userId.length === 24) {
      user = await User.findById(userId);
    } else {
      user = await User.findOne({ username: userId });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }

    let filter = { author: user._id };
    if (type === 'image') {
      filter.type = 'image';
    } else if (type === 'video') {
      filter.type = 'video';
    }

    const posts = await Post.find(filter)
      .sort({ createdAt: -1 })
      .populate('author', 'username profilePicture fullname checkMark')
      .lean();

    // Process posts with counts
    const processedPosts = await Promise.all(posts.map(async post => {
      // Get comment counts
      const commentCount = await Comment.countDocuments({
        post: post._id,
        parentId: null
      });

      const replyCount = await Comment.countDocuments({
        post: post._id,
        parentId: { $ne: null }
      });

      // For vanloc19_6's posts
      if (user.username === 'vanloc19_6') {
        const buffedLikes = 200000 + Math.floor(Math.random() * 300000);
        const buffedCommentCount = Math.floor(Math.random() * 100000) + 200000;
        const buffedReplyCount = Math.floor(Math.random() * 50000) + 100000;
        const totalComments = buffedCommentCount + buffedReplyCount;

        return {
          ...post,
          likes: buffedLikes,
          realLikes: post.likes?.length || 0,
          isBuffed: true,
          buffedLikes: buffedLikes,
          commentCount: buffedCommentCount,
          replyCount: buffedReplyCount,
          totalComments,
          totalLikes: buffedLikes,
          engagement: {
            likes: buffedLikes,
            comments: totalComments,
            total: buffedLikes + totalComments
          }
        };
      }

      // For normal users
      return {
        ...post,
        likes: post.likes?.length || 0,
        isBuffed: false,
        commentCount,
        replyCount,
        totalComments: commentCount + replyCount,
        totalLikes: post.likes?.length || 0,
        engagement: {
          likes: post.likes?.length || 0,
          comments: commentCount + replyCount,
          total: (post.likes?.length || 0) + commentCount + replyCount
        }
      };
    }));

    res.status(200).json({
      success: true,
      posts: processedPosts,
      isBuffedUser: user.username === 'vanloc19_6'
    });

  } catch (error) {
    console.error('Lỗi khi lấy bài viết người dùng:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const getPostById = async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await Post.findById(postId)
      .populate('author', 'username profilePicture fullname checkMark')
      .lean();

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bài viết'
      });
    }

    // Get comment counts
    const commentCount = await Comment.countDocuments({
      post: postId,
      parentId: null
    });

    const replyCount = await Comment.countDocuments({
      post: postId,
      parentId: { $ne: null }
    });

    // For vanloc19_6's post
    if (post.author.username === 'vanloc19_6') {
      const buffedLikes = 200000 + Math.floor(Math.random() * 300000);
      const buffedCommentCount = Math.floor(Math.random() * 100000) + 200000;
      const buffedReplyCount = Math.floor(Math.random() * 50000) + 100000;
      const totalComments = buffedCommentCount + buffedReplyCount;

      const postWithCounts = {
        ...post,
        likes: buffedLikes,
        realLikes: post.likes?.length || 0,
        isBuffed: true,
        buffedLikes: buffedLikes,
        commentCount: buffedCommentCount,
        replyCount: buffedReplyCount,
        totalComments,
        totalLikes: buffedLikes,
        engagement: {
          likes: buffedLikes,
          comments: totalComments,
          total: buffedLikes + totalComments
        }
      };

      return res.status(200).json({
        success: true,
        post: postWithCounts,
        isBuffedPost: true
      });
    }

    // For normal posts
    const postWithCounts = {
      ...post,
      likes: post.likes?.length || 0,
      isBuffed: false,
      commentCount,
      replyCount,
      totalComments: commentCount + replyCount,
      totalLikes: post.likes?.length || 0,
      engagement: {
        likes: post.likes?.length || 0,
        comments: commentCount + replyCount,
        total: (post.likes?.length || 0) + commentCount + replyCount
      }
    };

    res.status(200).json({
      success: true,
      post: postWithCounts,
      isBuffedPost: false
    });

  } catch (error) {
    console.error('Lỗi khi lấy bài viết:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

// Xóa bài viết theo ID
export const deletePostById = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const post = await Post.findById(postId);

    if (!post) {
      return res
        .status(404)
        .json({ success: false, message: 'Không tìm thấy bài viết' });
    }

    // Chỉ cho phép tác giả xóa bài viết của mình
    if (post.author.toString() !== userId) {
      return res
        .status(403)
        .json({
          success: false,
          message: 'Bạn không có quyền xóa bài viết này',
        });
    }

    // Nếu bạn dùng Cloudinary, bạn có thể xóa file tại đây bằng publicId:
    // await cloudinary.uploader.destroy(post.filePublicId);

    await post.deleteOne();

    // Cập nhật lại mảng posts của user (loại bỏ postId vừa xóa)
    await User.findByIdAndUpdate(userId, { $pull: { posts: postId } });

    res.status(200).json({ success: true, message: 'Xóa bài viết thành công' });
  } catch (error) {
    console.error('Lỗi khi xóa bài viết:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

// Controller để thêm comment vào post hoặc reel (hoặc video nếu có xử lý)
export const addComment = async (req, res) => {
  try {
    const authorId = req.user.id;
    const { itemId, itemType, text, parentId } = req.body;

    if (!itemId || !itemType || !text) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin cần thiết.'
      });
    }

    const mappedType = itemType === 'post' ? 'post' :
      itemType === 'reel' ? 'reels' :
        itemType === 'video' ? 'video' : 'post';

    // Check if this is a reply to a buffed comment
    if (parentId && parentId.startsWith('buff_comment_')) {
      // Create a buffed-style reply
      const replyUser = await User.findById(authorId).select('username profilePicture fullname').lean();
      const now = new Date();

      const buffedReply = {
        _id: `buff_reply_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text,
        author: {
          _id: replyUser._id,
          username: replyUser.username,
          profilePicture: replyUser.profilePicture,
          fullname: replyUser.fullname,
          isReal: true // Flag to indicate this is a real user
        },
        createdAt: now,
        likes: Math.floor(Math.random() * 1000), // Random likes for consistency
        likeCount: Math.floor(Math.random() * 1000),
        parentId,
        isBuffedReply: true,
        replies: []
      };

      // Return the buffed-style reply
      return res.status(201).json({
        success: true,
        message: 'Bình luận đã được thêm thành công',
        comment: buffedReply
      });
    }

    // Normal comment processing for non-buffed comments
    let savedComment;

    if (parentId && !parentId.startsWith('buff_comment_')) {
      savedComment = await createReplyForComment(
        authorId,
        parentId,
        text,
        itemId,
        mappedType
      );
    } else {
      if (mappedType === 'post') {
        savedComment = await createCommentForPost(authorId, itemId, text);
      } else if (mappedType === 'reel') {
        savedComment = await createCommentForReel(authorId, itemId, text);
      } else if (mappedType === 'video') {
        savedComment = await createCommentForVideo(authorId, itemId, text);
      }
    }

    if (!savedComment) {
      throw new Error('Không thể lưu bình luận');
    }

    const populatedComment = await Comment.findById(savedComment._id)
      .populate('author', 'username profilePicture fullname')
      .lean();

    res.status(201).json({
      success: true,
      message: 'Bình luận đã được thêm thành công',
      comment: populatedComment
    });

  } catch (error) {
    console.error('Lỗi khi thêm bình luận:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: error.message || 'Lỗi máy chủ khi thêm bình luận'
      });
    }
  }
};

// Controller để lấy danh sách comment và reply của một post hoặc reel (hoặc video)
export const getCommentsForItem = async (req, res) => {
  try {
    const { itemId, itemType } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const loggedInUserId = req.user?.id;

    if (!itemId || !itemType) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin item ID hoặc type.'
      });
    }

    const mappedType = itemType === 'post' ? 'post' :
      itemType === 'reel' ? 'reels' :
        itemType === 'video' ? 'video' : 'post';

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

      // Get real comments too
      const realComments = await Comment.find({ [mappedType]: itemId })
        .populate('author', 'username profilePicture fullname isVerified')
        .lean();

      // Process buffed comments
      randomComments.forEach(comment => {
        totalLikes += comment.likes;
        totalReplies += countNestedReplies(comment.replies);

        if (comment.replies.length > 0) {
          sortRepliesRecursively(comment.replies);
        }
      });

      // Process real comments
      const processedRealComments = realComments.map(comment => ({
        ...comment,
        isReal: true,
        likeCount: comment.likes?.length || 0
      }));

      // Combine and sort comments
      let allComments = [...processedRealComments, ...randomComments];

      // Prioritize logged in user's comments
      if (loggedInUserId) {
        const userComments = allComments.filter(
          comment => comment.isReal && comment.author?._id.toString() === loggedInUserId
        );

        const otherComments = allComments.filter(
          comment => !comment.isReal || comment.author?._id.toString() !== loggedInUserId
        );

        // Sort other comments by engagement
        otherComments.sort((a, b) => {
          const aEngagement = a.likes + (a.replies?.length || 0);
          const bEngagement = b.likes + (b.replies?.length || 0);
          return bEngagement - aEngagement;
        });

        comments = [
          ...userComments,
          ...otherComments.slice(0, limit - userComments.length)
        ];
      } else {
        // Sort by engagement if no logged-in user
        allComments.sort((a, b) => {
          const aEngagement = a.likes + (a.replies?.length || 0);
          const bEngagement = b.likes + (b.replies?.length || 0);
          return bEngagement - aEngagement;
        });
        comments = allComments.slice(0, limit);
      }

      metrics = {
        totalComments: mainCommentsCount + realComments.length,
        totalReplies: totalReplies,
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

      // Prioritize user's comments
      let userComments = [];
      let otherComments = [];

      if (loggedInUserId) {
        userComments = topLevelComments.filter(
          comment => comment.author?._id.toString() === loggedInUserId
        );
        otherComments = topLevelComments.filter(
          comment => comment.author?._id.toString() !== loggedInUserId
        );
      } else {
        otherComments = topLevelComments;
      }

      // Sort other comments by creation date
      otherComments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // Combine with user comments always first
      comments = [
        ...userComments,
        ...otherComments.slice(0, limit - userComments.length)
      ];

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
    const commentsWithOwnership = comments.map(comment => ({
      ...comment,
      isOwnComment: comment.author?._id.toString() === loggedInUserId,
      replies: comment.replies?.map(reply => ({
        ...reply,
        isOwnComment: reply.author?._id.toString() === loggedInUserId
      }))
    }));

    res.status(200).json({
      success: true,
      comments: commentsWithOwnership,
      metrics,
      isBuffedComments: isBuffedItem,
      currentLimit: limit,
      hasUserComments: commentsWithOwnership.some(c => c.isOwnComment)
    });

  } catch (error) {
    console.error('Lỗi khi lấy bình luận:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy bình luận'
    });
  }
};

// Helper functions
const countNestedReplies = (replies) => {
  if (!replies || replies.length === 0) return 0;
  return replies.length + replies.reduce((acc, reply) =>
    acc + countNestedReplies(reply.replies), 0
  );
};

const sortRepliesRecursively = (replies) => {
  replies.sort((a, b) => b.likes - a.likes);
  replies.forEach(reply => {
    if (reply.replies && reply.replies.length > 0) {
      sortRepliesRecursively(reply.replies);
    }
  });
};
