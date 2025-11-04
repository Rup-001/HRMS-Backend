const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['Super Admin', 'C-Level Executive', 'Company Admin', 'HR Manager', 'Manager', 'Employee'], 
    required: true 
  },
  isActive: { type: Boolean, default: true },
  invitationStatus: { 
    type: String, 
    enum: ['pending', 'sent', 'accepted', 'expired'], 
    default: 'pending' 
  },
  invitationExpires: { type: Date }
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

userSchema.methods.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);