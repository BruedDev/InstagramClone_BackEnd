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
      try {
        // Tạo bản ghi mới trong ArchivedStorie
        const archived = new ArchivedStorie({
          ...story.toObject(),
          isArchived: true
        });
        await archived.save();
        // Chỉ xóa story nếu lưu thành công
        await Story.deleteOne({ _id: story._id });
      } catch (err) {
        console.error('Lỗi khi lưu vào ArchivedStorie hoặc xóa Story:', err, '\nStoryId:', story._id);
        // KHÔNG xóa story nếu lỗi lưu kho lưu trữ
      }
    }
  } catch (error) {
    console.error('Lỗi khi archive stories:', error);
  }
};