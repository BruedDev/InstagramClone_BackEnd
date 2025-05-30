import Story from '../models/story.model.js';

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