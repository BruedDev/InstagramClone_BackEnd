// Sửa file cloudinaryUpload.js
import cloudinary from '../config/cloudinary.config.js';
import fs from 'fs';

// Upload hình ảnh
export const uploadImage = async (filePath, folder = 'images') => {
  try {
    // Kiểm tra file tồn tại trước khi upload
    if (!fs.existsSync(filePath)) {
      throw new Error(`File không tồn tại: ${filePath}`);
    }

    // Kiểm tra kích thước file
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      throw new Error('File rỗng không thể upload');
    }

    // Thêm tùy chọn để xử lý file từ iOS
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: 'auto', // Để tự động nhận diện loại file
      use_filename: true,
      unique_filename: true
    });

    // Xóa file tạm sau khi upload thành công
    fs.unlinkSync(filePath);
    return result;
  } catch (err) {
    console.error('Lỗi trong uploadImage:', err);
    // Đảm bảo xóa file tạm nếu có lỗi xảy ra
    fs.existsSync(filePath) && fs.unlinkSync(filePath);
    throw err;
  }
};

// Upload video
export const uploadVideo = async (filePath, folder = 'videos') => {
  try {
    // Kiểm tra file tồn tại trước khi upload
    if (!fs.existsSync(filePath)) {
      throw new Error(`File không tồn tại: ${filePath}`);
    }

    // Kiểm tra kích thước file
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      throw new Error('File rỗng không thể upload');
    }

    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: 'video',
      use_filename: true,
      unique_filename: true
    });

    // Xóa file tạm sau khi upload thành công
    fs.unlinkSync(filePath);
    return result;
  } catch (err) {
    console.error('Lỗi trong uploadVideo:', err);
    // Đảm bảo xóa file tạm nếu có lỗi xảy ra
    fs.existsSync(filePath) && fs.unlinkSync(filePath);
    throw err;
  }
};