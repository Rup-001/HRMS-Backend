const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.models.Department || mongoose.model('Department', departmentSchema);