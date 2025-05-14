import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Tạo thư mục tạm nếu chưa có
const tempDir = 'temp/';
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

// Cấu hình lưu file vào thư mục tạm
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  },
});

// Danh sách định dạng hợp lệ (ảnh + video)
const allowedTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif',
  'video/mp4',
  'video/quicktime',
];

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // Giới hạn tạm thời, xử lý trong fileFilter
  },
  fileFilter: function (req, file, cb) {
    // Kiểm tra định dạng file
    if (!allowedTypes.includes(file.mimetype)) {
      const error = new Error('Định dạng file không hợp lệ');
      error.code = 'INVALID_FILE_TYPE';
      return cb(error, false);
    }

    // Kiểm tra dung lượng theo loại file
    if (file.mimetype.startsWith('video/')) {
      if (file.size > 100 * 1024 * 1024) {
        const error = new Error('Video vượt quá giới hạn 100MB');
        error.code = 'FILE_TOO_LARGE';
        return cb(error, false);
      }
    } else if (file.mimetype.startsWith('image/')) {
      if (file.size > 10 * 1024 * 1024) {
        const error = new Error('Ảnh vượt quá giới hạn 10MB');
        error.code = 'FILE_TOO_LARGE';
        return cb(error, false);
      }
    }

    cb(null, true); // File hợp lệ
  }
});

export default upload;
