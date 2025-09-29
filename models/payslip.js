const mongoose = require('mongoose');

const payslipSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  month: { type: String, required: true },
  basicSalary: { type: Number, required: true },
  allowances: [{ name: String, amount: Number }],
  deductions: [{ name: String, amount: Number }],
  netPay: { type: Number, required: true },
  workDays: { type: Number },
  presentDays: { type: Number },
  leaveDays: { type: Number },
  absentDays: { type: Number },
  status: { type: String, enum: ['draft', 'generated', 'paid'], default: 'draft' },
  generatedDate: { type: Date },
  paidDate: { type: Date }
}, { timestamps: true });

// module.exports = mongoose.model('Payslip', payslipSchema);
module.exports = mongoose.models.Payslip || mongoose.model('Payslip', payslipSchema);
