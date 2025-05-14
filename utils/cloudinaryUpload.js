import cloudinary from '../config/cloudinary.config.js';
import fs from 'fs';

// Upload hình ảnh
export const uploadImage = async (filePath, folder = 'images') => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: 'image', // Loại là ảnh
    });
    fs.unlinkSync(filePath); // Xóa file tạm sau khi upload thành công
    return result;
  } catch (err) {
    // Đảm bảo xóa file tạm nếu có lỗi xảy ra
    fs.existsSync(filePath) && fs.unlinkSync(filePath);
    throw err;
  }
};

// Upload video
export const uploadVideo = async (filePath, folder = 'videos') => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: 'video', // Loại là video
    });
    fs.unlinkSync(filePath); // Xóa file tạm sau khi upload thành công
    return result;
  } catch (err) {
    // Đảm bảo xóa file tạm nếu có lỗi xảy ra
    fs.existsSync(filePath) && fs.unlinkSync(filePath);
    throw err;
  }
};
