
// models/leaveEntitlement.js
const mongoose = require('mongoose');

const leaveEntitlementSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  year: { type: Number, required: true },
  casual: { type: Number, default: 10 },
  sick: { type: Number, default: 14 },
  annual: { type: Number, default: 20 },
  maternity: { type: Number, default: 0 },
  lastEncashmentDate: { type: Date } // New field
}, { timestamps: true });

leaveEntitlementSchema.index({ employeeId: 1, year: 1 }, { unique: true });

module.exports = mongoose.models.LeaveEntitlement || mongoose.model('LeaveEntitlement', leaveEntitlementSchema);