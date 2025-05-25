import Post from '../models/post.model.js';
import Comment from '../models/comment.model.js';
import User from '../models/user.model.js';
import Story from '../models/story.model.js';
import { uploadImage, uploadVideo, uploadAudio } from '../utils/cloudinaryUpload.js';
import { generateRandomUser, generateRandomComment } from '../helper/buffAdmin.js';


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

    // 1. Gọi hàm để archive các story hết hạn
    await archiveExpiredStories();

    // 2. Lấy tất cả người dùng NGOẠI TRỪ người dùng hiện tại
    const allUsers = await User.find({
      _id: { $ne: myId }
    })
      .select('username profilePicture checkMark')
      .lean();

    // 3. Lấy tất cả stories còn hạn (chưa archive), không lấy của mình
    const stories = await Story.find({
      isArchived: false,
      expiresAt: { $gt: new Date() },
      author: { $ne: myId }
    })
      .populate('author', 'username profilePicture checkMark')
      .sort({ createdAt: -1 })
      .lean();

    // 4. Nhóm story theo tác giả và thêm thông tin audio
    const groupedStories = stories.reduce((acc, story) => {
      const authorId = story.author._id.toString();
      if (!acc[authorId]) {
        acc[authorId] = {
          user: story.author,
          stories: []
        };
      }

      const storyData = {
        ...story,
        hasAudio: story.mediaType.includes('/audio'),
        isVideoWithAudio: story.mediaType === 'video/audio',
        isImageWithAudio: story.mediaType === 'image/audio'
      };

      acc[authorId].stories.push(storyData);
      return acc;
    }, {});

    // 5. Thêm tất cả người dùng không có story vào kết quả
    const allUsersWithStories = allUsers.map(user => {
      const userId = user._id.toString();
      if (groupedStories[userId]) {
        return groupedStories[userId];
      } else {
        return {
          user: {
            _id: user._id,
            username: user.username,
            profilePicture: user.profilePicture,
            checkMark: user.checkMark
          },
          stories: []
        };
      }
    });

    // 6. Sort kết quả
    const sortedStories = allUsersWithStories.sort((a, b) => {
      if (b.user.checkMark && !a.user.checkMark) return 1;
      if (a.user.checkMark && !b.user.checkMark) return -1;

      if (a.stories.length > 0 && b.stories.length === 0) return -1;
      if (a.stories.length === 0 && b.stories.length > 0) return 1;

      if (a.stories.length > 0 && b.stories.length > 0) {
        return new Date(b.stories[0].createdAt) - new Date(a.stories[0].createdAt);
      }

      return a.user.username.localeCompare(b.user.username);
    });

    res.status(200).json({
      success: true,
      stories: sortedStories
    });
  } catch (error) {
    console.error('Lỗi khi lấy stories:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy stories' });
  }
};


// Tạo story mới - đã cập nhật để hỗ trợ audio
export const createStory = async (req, res) => {
  try {
    const { caption, hasAudio } = req.body;
    const authorId = req.user.id;

    // Kiểm tra có file media không
    if (!req.files || !req.files.media) {
      return res.status(400).json({
        success: false,
        message: 'Cần tải lên media cho story'
      });
    }

    const mediaFile = req.files.media[0];
    const audioFile = req.files.audio ? req.files.audio[0] : null;

    // Xác định loại media gốc
    const baseMediaType = mediaFile.mimetype.startsWith('image/') ? 'image' : 'video';

    // Xác định mediaType cuối cùng
    let mediaType = baseMediaType;
    if (audioFile) {
      mediaType = `${baseMediaType}/audio`;
    }

    // Upload media file
    let mediaResult;
    if (baseMediaType === 'image') {
      mediaResult = await uploadImage(mediaFile.path, 'stories');
    } else {
      mediaResult = await uploadVideo(mediaFile.path, 'stories');
    }

    // Upload audio file nếu có
    let audioResult = null;
    if (audioFile) {
      audioResult = await uploadAudio(audioFile.path, 'stories/audio');
    }

    // Tạo story mới
    const storyData = {
      author: authorId,
      media: mediaResult.secure_url,
      mediaType,
      mediaPublicId: mediaResult.public_id,
      caption,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
    };

    // Thêm thông tin audio nếu có
    if (audioResult) {
      storyData.audio = audioResult.secure_url;
      storyData.audioPublicId = audioResult.public_id;
      storyData.audioDuration = audioResult.duration || null;

      // Nếu là video + audio thì tắt âm thanh gốc
      if (baseMediaType === 'video') {
        storyData.muteOriginalAudio = true;
      }
    }

    const newStory = await Story.create(storyData);

    // Populate author information
    await newStory.populate('author', 'username profilePicture checkMark');

    res.status(201).json({
      success: true,
      message: 'Đã tạo story thành công',
      story: {
        ...newStory.toObject(),
        hasAudio: !!audioResult,
        isVideoWithAudio: mediaType === 'video/audio',
        isImageWithAudio: mediaType === 'image/audio'
      }
    });
  } catch (error) {
    console.error('Lỗi khi tạo story:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi tạo story'
    });
  }
};

// Archive story after expiration (scheduled job) - đã cập nhật để xử lý audio
export const archiveExpiredStories = async () => {
  try {
    // Find expired but not archived stories
    const expiredStories = await Story.find({
      expiresAt: { $lte: new Date() },
      isArchived: false
    });

    // Archive stories and update user's archived stories
    for (const story of expiredStories) {
      story.isArchived = true;
      await story.save();

      // Update user's archived stories với thông tin audio
      const archivedStoryData = {
        storyId: story._id,
        media: story.media,
        mediaType: story.mediaType,
        caption: story.caption,
        createdAt: story.createdAt,
        viewCount: story.viewers.length
      };

      // Thêm thông tin audio nếu có
      if (story.audio) {
        archivedStoryData.audio = story.audio;
        archivedStoryData.audioDuration = story.audioDuration;
        archivedStoryData.hasAudio = true;
      }

      await User.findByIdAndUpdate(story.author, {
        $push: { archivedStories: archivedStoryData }
      });
    }
  } catch (error) {
    console.error('Lỗi khi archive stories:', error);
  }
};

// Lấy kho lưu trữ stories đã hết hạn
export const getArchivedStories = async (req, res) => {
  try {
    const myId = req.user.id;

    // Lấy tất cả stories của người dùng
    const allStories = await Story.find({
      author: myId
    })
      .populate('author', 'username profilePicture checkMark')
      .populate('viewers.user', 'username profilePicture')
      .sort({ createdAt: -1 }) // Sắp xếp theo thời gian mới nhất
      .lean();

    // Format stories mà không nhóm theo tháng
    const formattedStories = allStories.map(story => ({
      _id: story._id,
      media: story.media,
      mediaType: story.mediaType,
      mediaPublicId: story.mediaPublicId,
      caption: story.caption,
      createdAt: story.createdAt,
      expiresAt: story.expiresAt,
      isArchived: story.isArchived,
      viewCount: story.viewers?.length || 0,
      viewers: story.viewers || [],
      author: {
        _id: story.author._id,
        username: story.author.username,
        profilePicture: story.author.profilePicture,
        checkMark: story.author.checkMark
      },
      audio: story.audio || null,
      audioPublicId: story.audioPublicId || null,
      audioDuration: story.audioDuration || null,
      hasAudio: story.mediaType.includes('/audio'),
      isVideoWithAudio: story.mediaType === 'video/audio',
      isImageWithAudio: story.mediaType === 'image/audio',
      muteOriginalAudio: story.muteOriginalAudio || false,
      status: story.isArchived ? 'archived' :
        new Date(story.expiresAt) < new Date() ? 'expired' : 'active'
    }));

    res.status(200).json({
      success: true,
      archivedStories: formattedStories
    });

  } catch (error) {
    console.error('Lỗi khi lấy kho lưu trữ stories:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy kho lưu trữ stories'
    });
  }
};