import { generateRandomUser } from './buffAdmin.js';

// Danh sách ảnh bài viết thật từ Unsplash/Pexels
const postImages = [
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1519125323398-675f0ddb6308?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1519985176271-adb1088fa94c?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=800&q=80',
  'https://images.pexels.com/photos/1130626/pexels-photo-1130626.jpeg?auto=compress&w=800&q=80',
  'https://images.pexels.com/photos/210186/pexels-photo-210186.jpeg?auto=compress&w=800&q=80',
  'https://images.pexels.com/photos/34950/pexels-photo.jpg?auto=compress&w=800&q=80',
  'https://images.pexels.com/photos/247917/pexels-photo-247917.jpeg?auto=compress&w=800&q=80',
  'https://images.pexels.com/photos/355465/pexels-photo-355465.jpeg?auto=compress&w=800&q=80',
];

// Một số caption tiếng Việt tự nhiên
const captions = [
  'Một ngày đẹp trời để đăng ảnh!',
  'Chill cùng bạn bè cuối tuần.',
  'Cà phê sáng và nắng nhẹ.',
  'Đi đâu cũng được, miễn là cùng nhau.',
  'Thích cảm giác bình yên như thế này.',
  'Cuộc sống là những chuyến đi.',
  'Hôm nay trời nhẹ lên cao.',
  'Mỗi ngày là một niềm vui mới.',
  'Thử thách bản thân với điều mới.',
  'Chỉ cần mỉm cười, mọi chuyện sẽ ổn.',
];

// Sinh danh sách bài viết ảo chân thật
export function generateBuffUserPostsHome(count = 10) {
  // Đảm bảo mỗi user chỉ xuất hiện 1 lần
  const users = Array.from({ length: count }, (_, i) => generateRandomUser(i));
  const usedImages = new Set();
  const posts = users.map((user, idx) => {
    // Random ảnh không trùng lặp
    let imgIdx;
    do {
      imgIdx = Math.floor(Math.random() * postImages.length);
    } while (usedImages.has(imgIdx) && usedImages.size < postImages.length);
    usedImages.add(imgIdx);
    const fileUrl = postImages[imgIdx];

    // Random số like, comment, reply nhỏ để chân thật
    const likes = Math.floor(Math.random() * 250) + 5; // 5-254
    const commentCount = Math.floor(Math.random() * 30); // 0-29
    const replyCount = Math.floor(Math.random() * 8); // 0-7
    const createdAt = new Date(Date.now() - Math.random() * 86400000 * 15); // 15 ngày gần nhất
    const caption = captions[Math.floor(Math.random() * captions.length)];

    return {
      _id: `buff_post_${user._id}_${idx}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      caption,
      desc: '',
      fileUrl,
      type: 'image',
      author: {
        _id: user._id,
        username: user.username,
        profilePicture: user.profilePicture,
        fullName: user.fullName,
        checkMark: user.isVerified || false
      },
      likes,
      totalLikes: likes,
      commentCount,
      replyCount,
      totalComments: commentCount + replyCount,
      isBuffed: true,
      engagement: {
        likes,
        comments: commentCount + replyCount,
        total: likes + commentCount + replyCount
      },
      isLike: false,
      hasStories: false,
      createdAt,
      isFake: true
    };
  });
  return posts;
}
