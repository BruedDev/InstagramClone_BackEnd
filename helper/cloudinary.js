import multer from 'multer';
import path from 'path';
import fs from 'fs';

const tempDir = 'temp/';
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

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
    fileSize: 100 * 1024 * 1024, // Giới hạn tạm (đề phòng), kiểm tra chi tiết ở controller
  },
  fileFilter: function (req, file, cb) {
    console.log('📄 mimeType:', file.mimetype);
    console.log('📎 originalname:', file.originalname);

    if (!allowedTypes.includes(file.mimetype)) {
      const error = new Error('Định dạng file không hợp lệ');
      error.code = 'INVALID_FILE_TYPE';
      return cb(error, false);
    }

    cb(null, true); // Cho phép lưu file, kiểm tra dung lượng sau
  }
});

export default upload;
