import Post from '../models/post.model.js';
import Comment from '../models/comment.model.js';

export const getPostHome = async (req, res) => {
  try {
    // Lấy tất cả bài viết, populate author và comments
    let posts = await Post.find()
      .populate('author', 'username profilePicture fullName checkMark')
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
      .sort({ createdAt: -1 })
      .lean();

    // Thêm số lượng comments và replies cho mỗi bài viết
    const postsWithCommentCounts = await Promise.all(
      posts.map(async (post) => {
        // Đếm comments gốc
        const commentCount = await Comment.countDocuments({
          post: post._id,
          parentId: null
        });

        // Đếm replies
        const replyCount = await Comment.countDocuments({
          post: post._id,
          parentId: { $ne: null }
        });

        // Cấu trúc comments thành dạng phân cấp
        const structuredComments = post.comments
          ?.filter(comment => !comment.parentId)
          ?.map(rootComment => ({
            ...rootComment,
            replies: post.comments.filter(
              reply => reply.parentId?.toString() === rootComment._id.toString()
            )
          })) || [];

        return {
          ...post,
          comments: structuredComments,
          commentCount,
          replyCount,
          totalComments: commentCount + replyCount
        };
      })
    );

    // Ưu tiên bài viết của user có checkMark lên đầu
    postsWithCommentCounts.sort((a, b) => {
      if (b.author?.checkMark && !a.author?.checkMark) return 1;
      if (a.author?.checkMark && !b.author?.checkMark) return -1;
      return 0;
    });

    res.status(200).json({
      success: true,
      posts: postsWithCommentCounts,
    });
  } catch (error) {
    console.error('Lỗi khi lấy bài viết trang chủ:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};