import mongoose from "mongoose";

const postSchema = new mongoose.Schema({
  caption: {
    type: String,
    max: 500,
    default: "",
  },
  desc: {
    type: String,
    max: 500,
  },
  fileUrl: {
    type: String, // URL từ Cloudinary
    required: true,
  },
  filePublicId: {
    type: String, // ID để xoá file khỏi Cloudinary
    required: true,
  },
  type: {
    type: String,
    enum: ['image', 'video'],
    required: true,
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  likes: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }
  ],
  comments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  }]
}, { timestamps: true });

const Post = mongoose.model('Post', postSchema);
export default Post;
