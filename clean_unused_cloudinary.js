// Script: clean_unused_cloudinary.js
import mongoose from 'mongoose';
import cloudinary from './config/cloudinary.config.js';
import Post from './models/post.model.js';
import Story from './models/story.model.js';
import User from './models/user.model.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/instagram-clone';

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('Đã kết nối MongoDB!');

  // 1. Lấy tất cả public_id đang sử dụng trong DB
  const postPublicIds = (await Post.find({}, 'filePublicId')).map(p => p.filePublicId);
  const storyMediaPublicIds = (await Story.find({}, 'mediaPublicId')).map(s => s.mediaPublicId).filter(Boolean);
  const storyAudioPublicIds = (await Story.find({}, 'audioPublicId')).map(s => s.audioPublicId).filter(Boolean);
  const userAvatarPublicIds = (await User.find({}, 'profilePicturePublicId')).map(u => u.profilePicturePublicId).filter(Boolean);

  const usedPublicIds = new Set([
    ...postPublicIds,
    ...storyMediaPublicIds,
    ...storyAudioPublicIds,
    ...userAvatarPublicIds
  ].filter(Boolean));

  // 2. Lấy tất cả public_id trên Cloudinary (từng resource_type)
  const allCloudinaryIds = [];
  for (const resource_type of ['image', 'video']) {
    let next_cursor = undefined;
    do {
      const res = await cloudinary.api.resources({ resource_type, max_results: 500, next_cursor });
      allCloudinaryIds.push(...res.resources.map(r => r.public_id));
      next_cursor = res.next_cursor;
    } while (next_cursor);
  }

  // 3. Tìm các public_id không còn sử dụng
  const unusedIds = allCloudinaryIds.filter(id => !usedPublicIds.has(id));
  console.log('Số lượng file không còn sử dụng:', unusedIds.length);
  if (unusedIds.length > 0) {
    console.log('Danh sách public_id không còn sử dụng:');
    unusedIds.forEach(id => console.log(id));
  }

  // 4. Xóa các file không còn sử dụng
  for (const id of unusedIds) {
    try {
      await cloudinary.uploader.destroy(id, { invalidate: true });
      console.log('Đã xóa:', id);
    } catch (err) {
      console.error('Lỗi xóa', id, err.message);
    }
  }

  await mongoose.disconnect();
  console.log('Hoàn thành!');
}

main().catch(err => {
  console.error('Lỗi:', err);
  process.exit(1);
});
