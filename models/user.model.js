import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tên không được để trống'],
      trim: true,
    },
    username: {
      type: String,
      unique: true,
      sparse: true, // Cho phép nhiều giá trị null
      trim: true,
      minlength: [3, 'Username phải có ít nhất 3 ký tự'],
      validate: {
        validator: function (value) {
          if (!value) return true; // Bỏ qua nếu không có giá trị
          return /^[a-zA-Z0-9._-]+$/.test(value); // Chỉ cho phép chữ cái, số, dấu chấm, gạch dưới, gạch ngang
        },
        message: 'Username chỉ được chứa chữ cái, số, dấu chấm, gạch dưới và gạch ngang',
      },
    },
    email: {
      type: String,
      required: [true, 'Email không được để trống'],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function (value) {
          return /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(value);
        },
        message: 'Email không hợp lệ',
      },
    },
    phone: {
      type: String,
      unique: true,
      sparse: true, // Cho phép nhiều giá trị null
      trim: true,
      validate: {
        validator: function (value) {
          if (!value) return true; // Bỏ qua nếu không có giá trị
          return /^[0-9+\s()-]{10,15}$/.test(value);
        },
        message: 'Số điện thoại không hợp lệ',
      },
    },
    password: {
      type: String,
      required: [true, 'Mật khẩu không được để trống'],
      minlength: [6, 'Mật khẩu phải có ít nhất 6 ký tự'],
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    avatar: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Thiết lập index cho các trường đăng nhập
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ phone: 1 });

// Hash mật khẩu trước khi lưu
userSchema.pre('save', async function (next) {
  // Nếu mật khẩu không được chỉnh sửa
  if (!this.isModified('password')) return next();

  try {
    // Hash mật khẩu với salt 10
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Cập nhật lastLogin khi đăng nhập thành công
userSchema.methods.updateLastLogin = function () {
  this.lastLogin = new Date();
  return this.save();
};

// So sánh mật khẩu
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

export default User;