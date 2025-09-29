const mongoose = require('mongoose');

const employeesAttendanceSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  date: { type: Date, required: true },
  check_in: { type: Date },
  check_out: { type: Date },
  work_hours: { type: Number },
  status: { type: String, enum: ['Present', 'Incomplete', 'Absent', 'Weekend', 'Leave', 'Holiday', 'Remote'], required: true },
  leave_type: { type: String, enum: ['sick', 'casual', 'annual', 'maternity', 'paternity', 'bereavement', null] }
}, { timestamps: true, indexes: [{ key: { employeeId: 1, date: 1 }, unique: true }] });

// module.exports = mongoose.model('EmployeesAttendance', employeesAttendanceSchema);
module.exports =
  mongoose.models.EmployeesAttendance ||
  mongoose.model("EmployeesAttendance", employeesAttendanceSchema);