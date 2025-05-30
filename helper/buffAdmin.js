// Vietnamese name data
export const vnFirstNames = [
  'Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng',
  'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý', 'Mai', 'Trương', 'Cao', 'Đinh'
];

export const vnMiddleNames = [
  'Thị', 'Văn', 'Đức', 'Hoài', 'Thanh', 'Minh', 'Hoàng', 'Thành', 'Như', 'Xuân',
  'Kim', 'Anh', 'Thu', 'Đình', 'Quang', 'Bảo', 'Ngọc', 'Tuấn', 'Hữu', 'Công'
];

export const vnLastNames = [
  'An', 'Anh', 'Bình', 'Chi', 'Đạt', 'Dung', 'Em', 'Giang', 'Hà', 'Hải',
  'Hằng', 'Hiền', 'Hiệp', 'Hoà', 'Hồng', 'Huệ', 'Hùng', 'Hương', 'Khang', 'Lan',
  'Linh', 'Long', 'Mai', 'Minh', 'Nam', 'Nga', 'Nhung', 'Phong', 'Phúc', 'Quân'
];

// Comment templates
export const commentTemplates = [
  'Đẹp quá {user} ơi! 😍',
  'Xin info {user} ơi 🙏',
  'Quá là xinh luôn {user} 💕',
  'Nhìn chill quá à nha 😎',
  'Ảnh này xịn thật sự 👏',
  'Idol của tôi đây rồi ✨',
  'Quá là perfect luôn {user} 💯',
  'Ghé qua tương tác nha {tag} 🌸',
  'Like mạnh cho {user} 👍'
];

export const replyTemplates = [
  'Cảm ơn {user} nhiều nha 🥰',
  'Dạ em cảm ơn chị {user} ạ ❤️',
  'Chị {user} dễ thương quá 🌸',
  'Em theo dõi chị {user} lâu rồi ạ ✨',
  '{user} ơi cho em xin info với ạ 🙏',
  'Dạ vâng ạ, cảm ơn {user} 💕'
];

// Helper functions
export const generateVietnameseName = () => {
  const firstName = vnFirstNames[Math.floor(Math.random() * vnFirstNames.length)];
  const middleName = vnMiddleNames[Math.floor(Math.random() * vnMiddleNames.length)];
  const lastName = vnLastNames[Math.floor(Math.random() * vnLastNames.length)];
  return `${firstName} ${middleName} ${lastName}`;
};

export const generateUsername = (fullName) => {
  const normalized = fullName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ /g, "");
  const random = Math.floor(Math.random() * 1000);
  return `${normalized}${random}`;
};

export const generateRandomUser = (index) => {
  const fullName = generateVietnameseName();
  const username = generateUsername(fullName);
  const gender = Math.random() > 0.5 ? 'women' : 'men';
  const seed = Math.floor(Math.random() * 70) + 1; // Limit to 1-70 for reliable images

  const defaultAvatar = 'https://thumbs.dreamstime.com/b/default-avatar-profile-icon-vector-social-media-user-portrait-176256935.jpg';

  // Try to use randomuser.me API first, fallback to default if needed
  const profilePicture = Math.random() > 0.3 ?
    `https://randomuser.me/api/portraits/${gender}/${seed}.jpg` :
    defaultAvatar;

  return {
    _id: `buff_user_${index}`,
    username,
    fullName,
    profilePicture,
    defaultProfilePicture: defaultAvatar,
    isVerified: Math.random() < 0.1,
    gender
  };
};

export const generateRandomComment = (itemId, index, users = [], parentComment = null) => {
  const user = users[Math.floor(Math.random() * users.length)] || generateRandomUser(index);
  const templates = parentComment ? replyTemplates : commentTemplates;
  let text = templates[Math.floor(Math.random() * templates.length)];

  text = text.replace('{user}', user.username);
  if (text.includes('{tag}')) {
    const taggedUser = users[Math.floor(Math.random() * users.length)] || generateRandomUser(index + 1);
    text = text.replace('{tag}', taggedUser.username);
  }

  return {
    _id: `buff_comment_${itemId}_${index}`,
    text,
    author: user,
    createdAt: new Date(Date.now() - Math.random() * 86400000 * 30),
    likes: Math.floor(Math.random() * 10000),
    likeCount: Math.floor(Math.random() * 10000),
    parentId: parentComment ? parentComment._id : null,
    replies: [],
    isBuffed: true
  };
};

export const generateNestedComments = (itemId, parentComment, depth = 0, users = [], maxDepth = 3) => {
  if (depth >= maxDepth || Math.random() > 0.7) return [];

  const replyCount = Math.floor(Math.random() * 5) + 1;
  const replies = [];

  for (let i = 0; i < replyCount; i++) {
    const reply = generateRandomComment(
      itemId,
      `${parentComment._id}_reply_${i}`,
      users,
      parentComment
    );
    reply.replies = generateNestedComments(itemId, reply, depth + 1, users, maxDepth);
    replies.push(reply);
  }

  return replies;
};

// Helper for generating buffed metrics
export const generateBuffedMetrics = () => {
  return {
    likes: 200000 + Math.floor(Math.random() * 300000),
    comments: Math.floor(Math.random() * 100000) + 200000,
    replies: Math.floor(Math.random() * 50000) + 100000
  };
};