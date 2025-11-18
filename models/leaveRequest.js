const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  type: { type: String, enum: ['casual', 'sick', 'festive', 'annual', 'maternity', 'remote'], required: true },
  status: { type: String, enum: ['pending', 'approved', 'denied'], default: 'pending' },
  approverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  isHalfDay: { type: Boolean, default: false },
  remarks: { type: String },
}, { timestamps: true });

// module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
module.exports = mongoose.models.LeaveRequest || mongoose.model('LeaveRequest', leaveRequestSchema);
