import Story from '../models/story.model.js';
import User from '../models/user.model.js';
import { uploadImage, uploadVideo, uploadAudio } from '../utils/cloudinaryUpload.js';

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

// Tạo story mới - đã cập nhật để hỗ trợ audio
export const createStory = async (req, res) => {
  try {
    const { caption } = req.body;
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

    // Thêm thông tin audio nếu có (chỉ cho image/audio hoặc video/audio)
    if (audioResult) {
      storyData.audio = audioResult.secure_url;
      storyData.audioPublicId = audioResult.public_id;
      storyData.audioDuration = audioResult.duration || null;
      if (baseMediaType === 'video') {
        storyData.muteOriginalAudio = true;
      }
    }

    const newStory = await Story.create(storyData);
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

// Lấy danh sách story của một người dùng (chỉ trả về _id và author)
export const getStoriesByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'Thiếu userId hoặc username' });
    }

    // Cho phép tìm bằng _id hoặc username
    let user;
    if (/^[0-9a-fA-F]{24}$/.test(userId)) {
      user = await User.findById(userId).lean();
      if (!user) {
        user = await User.findOne({ username: userId }).lean();
      }
    } else {
      user = await User.findOne({ username: userId }).lean();
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy user' });
    }

    const stories = await Story.find({
      author: user._id,
      isArchived: false,
      expiresAt: { $gt: new Date() }
    })
      .populate('author', 'username profilePicture checkMark')
      .sort({ createdAt: -1 })
      .lean();
    const hasStory = stories.length > 0;
    res.status(200).json({
      success: true,
      hasStory, // trả về true/false
      stories: stories.map(story => ({
        ...story,
        hasAudio: !!story.audio,
        isVideoWithAudio: story.mediaType === 'video/audio',
        isImageWithAudio: story.mediaType === 'image/audio'
      }))
    });
  } catch (error) {
    console.error('Lỗi khi lấy stories theo user:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy stories theo user' });
  }
};



