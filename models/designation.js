const mongoose = require('mongoose');

const designationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.models.Designation || mongoose.model('Designation', designationSchema);