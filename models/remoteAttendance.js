const mongoose = require('mongoose');
const { Schema } = mongoose;

const remoteAttendanceSchema = new Schema({
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  date: { type: Date, required: true },
  
  rosterScheduleId: { type: Schema.Types.ObjectId, ref: 'EmployeeWeeklySchedule' }, // Link to the weekly roster
  scheduledRemoteHours: { type: Number, required: true }, // e.g., 3, from the ShiftTemplate
  
  requestedHours: { type: Number, required: true }, // User can request full or partial hours
  reason: { type: String }, // Optional reason for partial hours
  
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  
  managerId: { type: Schema.Types.ObjectId, ref: 'User' }, // The manager at the time of request
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
  rejectionReason: String,

}, { timestamps: true });

remoteAttendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('RemoteAttendance', remoteAttendanceSchema);
