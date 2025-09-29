const mongoose = require('mongoose');

const salarySchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  basicSalary: { type: Number, required: true },
  allowances: [{ name: String, amount: Number }],
  deductions: [{ name: String, amount: Number }],
  effectiveDate: { type: Date, required: true },
  endDate: { type: Date }
}, { timestamps: true });

// module.exports = mongoose.model('Salary', salarySchema);
module.exports = mongoose.models.Salary || mongoose.model('Salary', salarySchema);
