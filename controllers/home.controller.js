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

    const loggedInUserId = req.user?.id;

    // Lấy danh sách userId có story còn hạn
    const now = new Date();
    const usersWithStories = await Story.distinct('author', {
      isArchived: false,
      expiresAt: { $gt: now }
    });
    const usersWithStoriesSet = new Set(usersWithStories.map(id => id.toString()));

    // Process posts with buffed data for vanloc19_6
    const processedPosts = await Promise.all(posts.map(async post => {
      // Đảm bảo likes là mảng string (nếu post.likes là undefined/null thì trả về [])
      const likesArr = Array.isArray(post.likes) ? post.likes.map(id => id?.toString()) : [];
      let isLike = false;
      if (loggedInUserId && likesArr.length > 0) {
        isLike = likesArr.includes(loggedInUserId.toString());
      }
      if (post.author.username === 'vanloc19_6') {
        // Nếu chưa có buffedLikes thì random 1 lần và lưu vào DB
        let buffedLikes = post.buffedLikes;
        if (typeof buffedLikes !== 'number') {
          buffedLikes = 200000 + Math.floor(Math.random() * 300000);
          await Post.findByIdAndUpdate(post._id, { buffedLikes });
        }
        // Lấy lại buffedCommentCount và buffedReplyCount từ DB, không random lại
        let buffedCommentCount = post.buffedCommentCount;
        let buffedReplyCount = post.buffedReplyCount;
        // Nếu chưa có thì random và lưu lại (chỉ random 1 lần duy nhất)
        let updateObj = {};
        if (typeof buffedCommentCount !== 'number') {
          buffedCommentCount = Math.floor(Math.random() * 100000) + 200000;
          updateObj.buffedCommentCount = buffedCommentCount;
        }
        if (typeof buffedReplyCount !== 'number') {
          buffedReplyCount = Math.floor(Math.random() * 50000) + 100000;
          updateObj.buffedReplyCount = buffedReplyCount;
        }
        if (Object.keys(updateObj).length > 0) {
          await Post.findByIdAndUpdate(post._id, updateObj);
        }
        // Luôn lấy lại số đã lưu (sau khi update nếu cần)
        const totalLikes = (buffedLikes || 0) + likesArr.length;
        const totalComments = (buffedCommentCount || 0) + (buffedReplyCount || 0);
        return {
          ...post,
          likes: totalLikes,
          realLikes: likesArr.length,
          isBuffed: true,
          buffedLikes: buffedLikes,
          commentCount: buffedCommentCount,
          replyCount: buffedReplyCount,
          totalComments: totalComments,
          totalLikes: totalLikes,
          engagement: {
            likes: totalLikes,
            comments: totalComments,
            total: totalLikes + totalComments
          },
          isLike: isLike,
          hasStories: usersWithStoriesSet.has(post.author._id.toString())
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
        totalLikes: post.likes?.length || 0, // Đảm bảo luôn có totalLikes
        isBuffed: false,
        engagement: {
          likes: post.likes?.length || 0,
          comments: commentCount + replyCount,
          total: (post.likes?.length || 0) + commentCount + replyCount
        },
        isLike: isLike,
        hasStories: usersWithStoriesSet.has(post.author._id.toString())
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

    // Lấy user vanloc19_6 để lấy _id
    const vanlocUser = await User.findOne({ username: 'vanloc19_6' }).lean();
    if (vanlocUser) {
      // Nếu không filter userId, thì lấy story của vanloc19_6 bất kể expiresAt
      if (!userId) {
        // Lấy tất cả story của vanloc19_6 (isArchived: false)
        const vanlocStories = await Story.find({
          author: vanlocUser._id,
          isArchived: false
        })
          .select('_id author')
          .populate('author', 'username profilePicture checkMark')
          .sort({ createdAt: -1 })
          .lean();
        // Lấy các story còn hạn của user khác
        storyCondition.author = { $ne: vanlocUser._id };
        const stories = await Story.find(storyCondition)
          .select('_id author')
          .populate('author', 'username profilePicture checkMark')
          .sort({ createdAt: -1 })
          .lean();
        // Ghép lại, story của vanloc19_6 luôn ở đầu
        const allStories = [...vanlocStories, ...stories];
        // Tách story của chính mình ra đầu tiên
        const myStories = allStories.filter(story => story.author._id.toString() === myId.toString());
        const otherStories = allStories.filter(story => story.author._id.toString() !== myId.toString());
        const sortedStories = [...myStories, ...otherStories];
        return res.status(200).json({
          success: true,
          stories: sortedStories.map(story => ({
            _id: story._id,
            author: story.author
          })),
          isSpecificUser: !!userId
        });
      } else if (userId && userId.toString() === vanlocUser._id.toString()) {
        // Nếu lấy story của userId là vanloc19_6 thì cũng lấy tất cả story (isArchived: false)
        const vanlocStories = await Story.find({
          author: vanlocUser._id,
          isArchived: false
        })
          .select('_id author')
          .populate('author', 'username profilePicture checkMark')
          .sort({ createdAt: -1 })
          .lean();
        return res.status(200).json({
          success: true,
          stories: vanlocStories.map(story => ({
            _id: story._id,
            author: story.author
          })),
          isSpecificUser: !!userId
        });
      }
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



