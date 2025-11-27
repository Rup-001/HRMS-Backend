const mongoose = require('mongoose');
const { Schema } = mongoose;

const employeeWeeklyScheduleSchema = new Schema({
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  weekStartDate: { type: Date, required: true }, // e.g., 2025-11-24

  // Day 0 = Sunday, 1 = Monday ... 6 = Saturday
  schedule: [{
    dayIndex: { type: Number, min: 0, max: 6, required: true },
    date: { type: Date, required: true },
    shiftCode: { type: String, required: true }, // "M", "E", "O"
    shiftTemplateId: { type: Schema.Types.ObjectId, ref: 'ShiftTemplate', required: true }
  }],

  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
}, { timestamps: true });

employeeWeeklyScheduleSchema.index({ employeeId: 1, weekStartDate: 1 }, { unique: true });

module.exports = mongoose.model('EmployeeWeeklySchedule', employeeWeeklyScheduleSchema);
