import Post from '../models/post.model.js';
import Comment from '../models/comment.model.js';
import User from '../models/user.model.js';
import Story from '../models/story.model.js';
import { archiveExpiredStories } from '../helper/ScanStory.js';

export const getPostHome = async (req, res) => {
  try {
    let posts = await Post.find()
      .populate('author', 'username profilePicture fullName checkMark')
      .sort({ createdAt: -1 })
      .lean();

    // Process posts with buffed data for vanloc19_6
    const processedPosts = await Promise.all(posts.map(async post => {
      if (post.author.username === 'vanloc19_6') {
        // Generate buffed data for vanloc19_6's posts
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
          totalComments: totalComments,
          totalLikes: buffedLikes,
          engagement: {
            likes: buffedLikes,
            comments: totalComments,
            total: buffedLikes + totalComments
          }
        };
      }

      // Normal post processing
      const commentCount = await Comment.countDocuments({
        post: post._id,
        parentId: null
      });

      const replyCount = await Comment.countDocuments({
        post: post._id,
        parentId: { $ne: null }
      });

      return {
        ...post,
        commentCount,
        replyCount,
        totalComments: commentCount + replyCount,
        likes: post.likes?.length || 0,
        isBuffed: false,
        engagement: {
          likes: post.likes?.length || 0,
          comments: commentCount + replyCount,
          total: (post.likes?.length || 0) + commentCount + replyCount
        }
      };
    }));

    // Sort posts - prioritize vanloc19_6's posts and then other verified users
    processedPosts.sort((a, b) => {
      if (b.author?.username === 'vanloc19_6') return 1;
      if (a.author?.username === 'vanloc19_6') return -1;
      if (b.author?.checkMark && !a.author?.checkMark) return 1;
      if (a.author?.checkMark && !b.author?.checkMark) return -1;
      return 0;
    });

    res.status(200).json({
      success: true,
      posts: processedPosts,
    });
  } catch (error) {
    console.error('Lỗi khi lấy bài viết trang chủ:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
  }
};

export const suggestUsers = async (req, res) => {
  try {
    const myId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;

    const currentUser = await User.findById(myId).select('following').lean();
    const followingIds = currentUser ? currentUser.following.map(id => id.toString()) : [];

    let users = await User.find({
      _id: { $ne: myId, $nin: followingIds }
    })
      .select('-password -email -phoneNumber -followers -following -posts')
      .limit(limit)
      .lean();

    users = users.map(u => {
      // Buff cho vanloc19_6
      if (u.username === 'vanloc19_6') {
        return {
          ...u,
          checkMark: true,
          followersCount: 1000000,
          isBuffed: true
        };
      }
      return {
        ...u,
        checkMark: !!u.checkMark,
        followersCount: 0, // Không hiển thị số followers thật cho suggestion
        isBuffed: false
      };
    });

    users.sort((a, b) => {
      // vanloc19_6 luôn ở đầu
      if (a.username === 'vanloc19_6') return -1;
      if (b.username === 'vanloc19_6') return 1;

      // Sau đó sắp xếp theo checkMark và username
      if (b.checkMark && !a.checkMark) return 1;
      if (!b.checkMark && a.checkMark) return -1;
      if (a.username < b.username) return -1;
      if (a.username > b.username) return 1;
      return 0;
    });

    res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    console.error('Lỗi khi gợi ý người dùng:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi gợi ý người dùng' });
  }
};

// Lấy stories cho trang chủ - đã cập nhật để hỗ trợ audio
export const getStoryHome = async (req, res) => {
  try {
    const myId = req.user.id;
    const { userId } = req.query; // Thêm tham số userId từ query

    // 1. Gọi hàm để archive các story hết hạn
    await archiveExpiredStories();

    // 2. Tạo điều kiện query dựa trên userId
    let userCondition = {};
    let storyCondition = {
      isArchived: false,
      expiresAt: { $gt: new Date() }
    };

    if (userId) {
      userCondition = { _id: userId };
      storyCondition.author = userId;
    } else {
      userCondition = {}; // Lấy tất cả users
      // Không filter author, lấy tất cả story còn hạn
    }

    // 3. Lấy users theo điều kiện
    const allUsers = await User.find(userCondition)
      .select('username profilePicture checkMark')
      .lean();

    // 4. Lấy stories theo điều kiện
    const stories = await Story.find(storyCondition)
      .select('_id author')
      .populate('author', 'username profilePicture checkMark')
      .sort({ createdAt: -1 })
      .lean();

    // Tách story của chính mình ra đầu tiên
    const myStories = stories.filter(story => story.author._id.toString() === myId.toString());
    const otherStories = stories.filter(story => story.author._id.toString() !== myId.toString());
    const sortedStories = [...myStories, ...otherStories];

    res.status(200).json({
      success: true,
      stories: sortedStories.map(story => ({
        _id: story._id,
        author: story.author
      })),
      isSpecificUser: !!userId
    });
  } catch (error) {
    console.error('Lỗi khi lấy stories:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy stories' });
  }
};



