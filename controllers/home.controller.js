import Post from '../models/post.model.js';

// Lấy tất cả bài viết, ưu tiên bài viết của user có checkMark lên đầu
export const getPostHome = async (req, res) => {
  try {
    // Lấy tất cả bài viết, populate author (lấy checkMark, username, profilePicture, fullName)
    let posts = await Post.find()
      .populate('author', 'username profilePicture fullName checkMark')
      .sort({ createdAt: -1 })
      .lean();

    // Ưu tiên bài viết của user có checkMark lên đầu
    posts.sort((a, b) => {
      if (b.author?.checkMark && !a.author?.checkMark) return 1;
      if (a.author?.checkMark && !b.author?.checkMark) return -1;
      return 0;
    });

    res.status(200).json({
      success: true,
      posts,
    });
  } catch (error) {
    console.error('Lỗi khi lấy bài viết trang chủ:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};