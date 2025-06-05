import Story from '../models/story.model.js';
import ArchivedStorie from '../models/archivedStory.model.js';
import User from '../models/user.model.js';

// Archive story after expiration (scheduled job) - đã cập nhật để xử lý audio
export const archiveExpiredStories = async () => {
  try {
    // Find expired but not archived stories
    const expiredStories = await Story.find({
      expiresAt: { $lte: new Date() },
      isArchived: false
    }).populate('author', 'username');

    for (const story of expiredStories) {
      // Nếu là user vanloc19_6 thì bỏ qua, không archive
      if (story.author && story.author.username === 'vanloc19_6') {
        continue;
      }
      // Tạo bản ghi mới trong ArchivedStorie
      const archived = new ArchivedStorie({
        ...story.toObject(),
        isArchived: true
      });
      await archived.save();

      // Xóa story khỏi collection Story
      await Story.deleteOne({ _id: story._id });
    }
  } catch (error) {
    console.error('Lỗi khi archive stories:', error);
  }
};