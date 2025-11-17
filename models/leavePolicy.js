
// models/leavePolicy.js
const mongoose = require('mongoose');

const leavePolicySchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, unique: true },
  casual: { type: Number, default: 10 },
  sick: { type: Number, default: 14 },
  annual: { type: Number, default: 20 },
  maternity: { type: Number, default: 84 },
  festive: { type: Number, default: 11 }
}, { timestamps: true });

module.exports = mongoose.models.LeavePolicy || mongoose.model('LeavePolicy', leavePolicySchema);
