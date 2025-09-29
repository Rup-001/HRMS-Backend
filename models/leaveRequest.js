const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  type: { type: String, enum: ['sick', 'casual', 'annual', 'maternity', 'paternity', 'bereavement', 'remote'], required: true },
  status: { type: String, enum: ['pending', 'approved', 'denied'], default: 'pending' },
  approverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  isHalfDay: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);