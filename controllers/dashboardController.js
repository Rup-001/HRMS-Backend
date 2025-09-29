const Employee = require('../models/employee');
const EmployeesAttendance = require('../models/EmployeesAttendance');
const Payslip = require('../models/payslip');
const LeaveRequest = require('../models/leaveRequest');
const Holiday = require('../models/holiday');
const moment = require('moment-timezone');

exports.getEmployeeDashboard = async (req, res) => {
  try {
    const { employeeId, companyId } = req.user;
    if (req.user.role !== 'Employee') {
      return res.status(403).json({ success: false, error: 'Access restricted to Employee role' });
    }

    const employee = await Employee.findOne({ _id: employeeId, companyId }).select('fullName newEmployeeCode designation assignedDepartment joiningDate email personalPhoneNumber');
    if (!employee) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }

    const startDate = moment().tz('Asia/Dhaka').subtract(7, 'days').startOf('day');
    const attendance = await EmployeesAttendance.find({
      employeeId,
      companyId,
      date: { $gte: startDate.toDate() }
    }).select('date check_in check_out work_hours status leave_type');

    const payslips = await Payslip.find({
      employeeId,
      companyId,
      month: { $gte: moment().subtract(3, 'months').format('YYYY-MM') }
    }).select('month netPay status generatedDate');

    const leaveRequests = await LeaveRequest.find({
      employeeId,
      companyId,
      startDate: { $gte: moment().startOf('day').toDate() }
    }).select('startDate endDate type status isHalfDay');

    const holidays = await Holiday.find({
      $or: [{ companyId }, { isNational: true }],
      date: { $gte: moment().startOf('day').toDate(), $lte: moment().add(30, 'days').endOf('day').toDate() }
    }).select('date name isNational');

    const response = {
      personalInfo: {
        fullName: employee.fullName,
        employeeCode: employee.newEmployeeCode,
        designation: employee.designation,
        department: employee.assignedDepartment,
        joiningDate: moment(employee.joiningDate).format('YYYY-MM-DD'),
        email: employee.email,
        phone: employee.personalPhoneNumber
      },
      attendance: attendance.map(a => ({
        date: moment(a.date).tz('Asia/Dhaka').format('YYYY-MM-DD'),
        check_in: a.check_in ? moment(a.check_in).tz('Asia/Dhaka').format('HH:mm:ss') : null,
        check_out: a.check_out ? moment(a.check_out).tz('Asia/Dhaka').format('HH:mm:ss') : null,
        work_hours: a.work_hours ? a.work_hours.toFixed(2) : null,
        status: a.status,
        leave_type: a.leave_type
      })),
      payslips: payslips.map(p => ({
        month: p.month,
        netPay: p.netPay,
        status: p.status,
        generatedDate: moment(p.generatedDate).format('YYYY-MM-DD')
      })),
      leaveRequests: leaveRequests.map(l => ({
        startDate: moment(l.startDate).format('YYYY-MM-DD'),
        endDate: moment(l.endDate).format('YYYY-MM-DD'),
        type: l.type,
        status: l.status,
        isHalfDay: l.isHalfDay
      })),
      holidays: holidays.map(h => ({
        date: moment(h.date).format('YYYY-MM-DD'),
        name: h.name,
        isNational: h.isNational
      }))
    };

    res.status(200).json({ success: true, data: response });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};