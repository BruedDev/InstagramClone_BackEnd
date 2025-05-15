// controllers/post.controllers.js

import Post from '../models/post.model.js';
import { uploadImage, uploadVideo } from '../utils/cloudinaryUpload.js';
import User from '../models/user.model.js';

// Đăng bài viết (ảnh hoặc video)
export const createPost = async (req, res) => {
  try {
    const { caption, desc, type } = req.body;
    const authorId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Không có file nào được tải lên' });
    }

    if (!['image', 'video'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Loại file không hợp lệ (image hoặc video)' });
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
    await User.findByIdAndUpdate(
      authorId,
      { $push: { posts: newPost._id } }
    );

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
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    // Tạo điều kiện lọc bài viết
    let filter = { author: user._id };  // Dùng user._id để lọc theo ID người dùng
    if (type === 'image') {
      filter.type = 'image';
    } else if (type === 'video') {
      filter.type = 'video';
    }

    // Lấy bài viết với điều kiện lọc
    const posts = await Post.find(filter)
      .sort({ createdAt: -1 })
      .populate('author', 'username profilePicture fullname')  // Đảm bảo lấy thông tin người dùng
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

    const post = await Post.findById(postId)
      .populate('author', 'username profilePicture') // Ensure 'author' references the User model
      .lean();

    if (!post) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });
    }

    res.status(200).json({ success: true, post });
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
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });
    }

    // Chỉ cho phép tác giả xóa bài viết của mình
    if (post.author.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa bài viết này' });
    }

    // Nếu bạn dùng Cloudinary, bạn có thể xóa file tại đây bằng publicId:
    // await cloudinary.uploader.destroy(post.filePublicId);

    await post.deleteOne();

    // Cập nhật lại mảng posts của user (loại bỏ postId vừa xóa)
    await User.findByIdAndUpdate(
      userId,
      { $pull: { posts: postId } }
    );

    res.status(200).json({ success: true, message: 'Xóa bài viết thành công' });
  } catch (error) {
    console.error('Lỗi khi xóa bài viết:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};
