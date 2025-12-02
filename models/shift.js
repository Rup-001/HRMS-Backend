const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  name: { type: String, required: true },
  startTime: { type: String, required: true, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ }, // HH:mm format
  endTime: { type: String, required: true, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },   // HH:mm format
  gracePeriod: { type: Number, default: 0 }, // Minutes for late arrival grace
  overtimeThreshold: { type: Number, default: 0 }, // Minutes after which overtime starts
  workingHours: { type: Number, required: true }, // Calculated total working hours for the shift
  weekendDays: { type: [Number], default: [5, 6] } // 0=Sunday, 1=Monday, ..., 5=Friday, 6=Saturday. Default: Friday & Saturday
}, { timestamps: true });

shiftSchema.index({ companyId: 1, name: 1 }, { unique: true });

module.exports = mongoose.models.Shift || mongoose.model('Shift', shiftSchema);
