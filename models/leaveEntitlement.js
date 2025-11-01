
// models/leaveEntitlement.js
const mongoose = require('mongoose');

const leaveEntitlementSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, unique: true },
  year: { type: Number, required: true },
  casual: { type: Number, default: 10 },
  sick: { type: Number, default: 14 },
  earned: { type: Number, default: 20 },
  maternity: { type: Number, default: 0 },
  paternity: { type: Number, default: 0 },
  bereavement: { type: Number, default: 0 },
  festive: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.models.LeaveEntitlement || mongoose.model('LeaveEntitlement', leaveEntitlementSchema);
