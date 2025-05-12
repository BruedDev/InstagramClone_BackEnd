import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Tạo thư mục tạm nếu chưa có
const tempDir = 'temp/';
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir); // Tạo thư mục tạm nếu chưa tồn tại
}

// Cấu hình lưu file vào thư mục tạm
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tempDir); // Lưu vào thư mục tạm
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname); // Lấy phần mở rộng của file
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9); // Tạo tên file duy nhất
    cb(null, file.fieldname + '-' + uniqueSuffix + ext); // Đặt tên file
  },
});

const upload = multer({
  storage,
  limits: {
    // Giới hạn dung lượng file: 100MB cho video, 10MB cho ảnh
    fileSize: (req, file, cb) => {
      if (file.mimetype.includes('video')) {
        cb(null, 100 * 1024 * 1024); // Giới hạn video 100MB
      } else {
        cb(null, 10 * 1024 * 1024); // Giới hạn ảnh 10MB
      }
    },
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true); // Cho phép file hợp lệ
    } else {
      const error = new Error('Định dạng file không hợp lệ');
      error.code = 'INVALID_FILE_TYPE'; // Thêm mã lỗi
      cb(error, false); // Từ chối file không hợp lệ
    }
  },
});

export default upload;
