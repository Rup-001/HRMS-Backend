const Payslip = require('../models/payslip');
const Salary = require('../models/salary');
const EmployeesAttendance = require('../models/employeesAttendance');
const LeaveRequest = require('../models/leaveRequest');
const moment = require('moment-timezone');

exports.generatePayslip = async (req, res) => {
  try {
    const { employeeId, month } = req.body;
    if (!employeeId || !month) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    const companyId = req.user.companyId;
    const salary = await Salary.findOne({ employeeId, companyId, effectiveDate: { $lte: moment(month, 'YYYY-MM').endOf('month').toDate() } }).sort({ effectiveDate: -1 });
    if (!salary) {
      return res.status(404).json({ success: false, error: 'Salary not found' });
    }

    const startDate = moment(month, 'YYYY-MM').startOf('month').toDate();
    const endDate = moment(month, 'YYYY-MM').endOf('month').toDate();
    const attendance = await EmployeesAttendance.find({ employeeId, companyId, date: { $gte: startDate, $lte: endDate } });
    const leaveRequests = await LeaveRequest.find({ employeeId, companyId, status: 'approved', startDate: { $lte: endDate }, endDate: { $gte: startDate } });

    const workDays = moment(endDate).diff(startDate, 'days') + 1;
    const presentDays = attendance.filter(a => a.status === 'Present').length;
    const leaveDays = leaveRequests.reduce((sum, lr) => sum + moment(lr.endDate).diff(lr.startDate, 'days') + 1, 0);
    const absentDays = workDays - presentDays - leaveDays - attendance.filter(a => a.status === 'Weekend' || a.status === 'Holiday').length;

    const netPay = salary.basicSalary + salary.allowances.reduce((sum, a) => sum + a.amount, 0) - salary.deductions.reduce((sum, d) => sum + d.amount, 0);

    const payslip = new Payslip({
      companyId,
      employeeId,
      month,
      basicSalary: salary.basicSalary,
      allowances: salary.allowances,
      deductions: salary.deductions,
      netPay,
      workDays,
      presentDays,
      leaveDays,
      absentDays,
      status: 'generated',
      generatedDate: new Date()
    });
    await payslip.save();
    res.status(201).json({ success: true, data: payslip });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.getPayslips = async (req, res) => {
  try {
    const { employeeId, month } = req.query;
    const query = req.user.role === 'Employee' ? { employeeId: req.user.employeeId, companyId: req.user.companyId } : 
                 req.user.role === 'Manager' ? { companyId: req.user.companyId } : {};
    if (employeeId) {
      query.employeeId = employeeId;
      if (req.user.role === 'Employee' && req.user.employeeId.toString() !== employeeId) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
    }
    if (month) {
      query.month = month;
    }
    const payslips = await Payslip.find(query).populate('employeeId', 'fullName newEmployeeCode');
    res.status(200).json({ success: true, data: payslips });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};