// controllers/post.controllers.js

import Post from '../models/post.model.js';
import { uploadImage, uploadVideo } from '../utils/cloudinaryUpload.js';
import User from '../models/user.model.js';
// Imports for comment functionality
import Comment from '../models/comment.model.js';
import {
  createCommentForPost,
  createCommentForReel,
  createReplyForComment,
} from '../server/comment.server.js';

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

// Lấy bài viết của 1 người dùng với bộ lọc type
export const getPostUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { type } = req.query;

    // Kiểm tra nếu userId là một ID hợp lệ, nếu không thì tìm theo username
    let user;

    // Kiểm tra nếu userId là một ID MongoDB hợp lệ (24 ký tự), nếu không tìm bằng username
    if (userId.length === 24) {
      user = await User.findById(userId);
    } else {
      user = await User.findOne({ username: userId });
    }

    // Nếu không tìm thấy người dùng, trả về lỗi
    if (!user) {
      console.log('User not found:', userId);
      return res
        .status(404)
        .json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    // Tạo điều kiện lọc bài viết
    let filter = { author: user._id }; // Dùng user._id để lọc theo ID người dùng
    if (type === 'image') {
      filter.type = 'image';
    } else if (type === 'video') {
      filter.type = 'video';
    }

    // Lấy bài viết với điều kiện lọc
    const posts = await Post.find(filter)
      .sort({ createdAt: -1 })
      .populate('author', 'username profilePicture fullname') // Đảm bảo lấy thông tin người dùng
      .lean();

    res.status(200).json({
      success: true,
      posts,
    });
  } catch (error) {
    console.error('Lỗi khi lấy bài viết người dùng:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

// Lấy bài viết theo ID
export const getPostById = async (req, res) => {
  try {
    const { postId } = req.params;

    // Fetch post with populated comments and author
    const post = await Post.findById(postId)
      .populate('author', 'username profilePicture')
      .populate({
        path: 'comments',
        populate: [
          {
            path: 'author',
            select: 'username profilePicture fullname'
          },
          {
            path: 'replies',
            populate: {
              path: 'author',
              select: 'username profilePicture fullname'
            }
          }
        ],
        options: { sort: { createdAt: -1 } }
      })
      .lean();

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bài viết'
      });
    }

    // Count comments and replies
    const commentCount = await Comment.countDocuments({
      post: postId,
      parentId: null
    });

    const replyCount = await Comment.countDocuments({
      post: postId,
      parentId: { $ne: null }
    });

    // Add counts to post object
    const postWithCounts = {
      ...post,
      commentCount,
      replyCount,
      totalComments: commentCount + replyCount
    };

    // Structure comments hierarchically
    const structuredComments = post.comments
      .filter(comment => !comment.parentId) // Get root comments only
      .map(rootComment => ({
        ...rootComment,
        replies: post.comments.filter(
          reply => reply.parentId?.toString() === rootComment._id.toString()
        )
      }));

    // Replace flat comments array with structured one
    postWithCounts.comments = structuredComments;

    res.status(200).json({
      success: true,
      post: postWithCounts
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

// Hàm map itemType
const mapItemType = (type) => {
  if (type === 'image' || type === 'post') return 'post';
  if (type === 'video') return 'video';
  if (type === 'reel') return 'reel';
  return null;
};

// Controller để thêm comment vào post hoặc reel (hoặc video nếu có xử lý)
export const addComment = async (req, res) => {
  try {
    const authorId = req.user.id;
    const { itemId, itemType, text, parentId } = req.body; // itemId là ID của post hoặc reel hoặc video

    if (!itemId || !itemType || !text) {
      return res
        .status(400)
        .json({ success: false, message: 'Thiếu thông tin cần thiết.' });
    }

    const mappedType = mapItemType(itemType);

    if (!mappedType || (mappedType !== 'post' && mappedType !== 'reel' && mappedType !== 'video')) {
      return res
        .status(400)
        .json({ success: false, message: 'Loại item không hợp lệ.' });
    }

    let savedComment;

    if (parentId) {
      // Đây là một reply
      savedComment = await createReplyForComment(
        authorId,
        parentId,
        text,
        itemId,
        mappedType
      );
    } else {
      // Đây là một comment gốc
      if (mappedType === 'post') {
        savedComment = await createCommentForPost(authorId, itemId, text);
      } else if (mappedType === 'reel') {
        savedComment = await createCommentForReel(authorId, itemId, text);
      } else if (mappedType === 'video') {
        // Nếu bạn có hàm xử lý comment cho video thì gọi ở đây, ví dụ:
        savedComment = await createCommentForVideo(authorId, itemId, text);
      }
    }

    if (!savedComment) {
      throw new Error('Không thể lưu bình luận');
    }

    // Populate author thông tin để trả về client
    const populatedComment = await Comment.findById(savedComment._id)
      .populate('author', 'username profilePicture')
      .lean();

    res.status(201).json({
      success: true,
      message: 'Bình luận đã được thêm thành công',
      comment: populatedComment,
    });
  } catch (error) {
    console.error('Lỗi khi thêm bình luận:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: error.message || 'Lỗi máy chủ khi thêm bình luận' });
    }
  }
};

// Controller để lấy danh sách comment và reply của một post hoặc reel (hoặc video)
export const getCommentsForItem = async (req, res) => {
  try {
    const { itemId, itemType } = req.params;

    if (!itemId || !itemType) {
      return res
        .status(400)
        .json({ success: false, message: 'Thiếu thông tin item ID hoặc type.' });
    }

    const mappedType = mapItemType(itemType);

    if (!mappedType || (mappedType !== 'post' && mappedType !== 'reel' && mappedType !== 'video')) {
      return res
        .status(400)
        .json({ success: false, message: 'Loại item không hợp lệ.' });
    }

    let queryCondition = {};
    if (mappedType === 'post') {
      queryCondition.post = itemId;
    } else if (mappedType === 'reel') {
      queryCondition.reels = itemId;
    } else if (mappedType === 'video') {
      queryCondition.video = itemId; // Cần có field video trong schema Comment nếu dùng
    }

    const allCommentsForItem = await Comment.find(queryCondition)
      .populate('author', 'username profilePicture fullname')
      .sort({ createdAt: 'asc' })
      .lean();

    // Cấu trúc comments và replies
    const commentMap = {};
    const topLevelComments = [];

    allCommentsForItem.forEach(comment => {
      comment.replies = [];
      commentMap[comment._id.toString()] = comment;

      if (comment.parentId) {
        const parentComment = commentMap[comment.parentId.toString()];
        if (parentComment) {
          parentComment.replies.push(comment);
        } else {
          console.warn(`Orphan reply found: ${comment._id} for parent ${comment.parentId}`);
        }
      } else {
        topLevelComments.push(comment);
      }
    });

    res.status(200).json({
      success: true,
      comments: topLevelComments,
    });
  } catch (error) {
    console.error('Lỗi khi lấy bình luận:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};
