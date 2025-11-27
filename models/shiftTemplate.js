const mongoose = require('mongoose');
const { Schema } = mongoose;

const shiftTemplateSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  code: { type: String, required: true }, // "M", "E", "Remote-M", "O", "RE", etc.
  label: { type: String, required: true }, // "Morning On-Site + Remote"
  isOff: { type: Boolean, default: false },
  onSiteHours: { type: Number, default: 0 },     // e.g., 6 hours
  remoteHours: { type: Number, default: 0 },     // e.g., 3 hours
  onSiteShiftId: { type: Schema.Types.ObjectId, ref: 'Shift' }, // Link to actual time (e.g., 8AM-2PM)
  description: String
}, { timestamps: true });

shiftTemplateSchema.index({ companyId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('ShiftTemplate', shiftTemplateSchema);
