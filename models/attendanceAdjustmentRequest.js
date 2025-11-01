
// models/attendanceAdjustmentRequest.js
const mongoose = require('mongoose');

const attendanceAdjustmentRequestSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  attendanceDate: { type: Date, required: true },
  originalCheckIn: { type: Date },
  originalCheckOut: { type: Date },
  proposedCheckIn: { type: Date },
  proposedCheckOut: { type: Date },
  reason: { type: String, required: true },
  status: {
    type: String,
    enum: [
      'pending_manager_approval',
      'pending_hr_approval',
      'approved',
      'denied_by_manager',
      'denied_by_hr'
    ],
    default: 'pending_manager_approval'
  },
  managerApproverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  managerApprovalDate: { type: Date },
  managerComment: { type: String },
  hrApproverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }, // Could be a specific HR employee or just a placeholder
  hrApprovalDate: { type: Date },
  hrComment: { type: String },
}, { timestamps: true });

module.exports = mongoose.models.AttendanceAdjustmentRequest || mongoose.model('AttendanceAdjustmentRequest', attendanceAdjustmentRequestSchema);
