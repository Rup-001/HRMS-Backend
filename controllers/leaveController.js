// const LeaveRequest = require('../models/leaveRequest');
// const moment = require('moment-timezone');

// exports.createLeaveRequest = async (req, res) => {
//   try {
//     const { startDate, endDate, type, reason, isHalfDay } = req.body;
//     if (!startDate || !endDate || !type) {
//       return res.status(400).json({ success: false, error: 'Missing required fields' });
//     }
//     const leaveRequest = new LeaveRequest({
//       companyId: req.user.companyId,
//       employeeId: req.user.employeeId,
//       startDate: moment.tz(startDate, 'Asia/Dhaka').startOf('day').toDate(),
//       endDate: moment.tz(endDate, 'Asia/Dhaka').endOf('day').toDate(),
//       type,
//       reason,
//       isHalfDay
//     });
//     await leaveRequest.save();
//     res.status(201).json({ success: true, data: leaveRequest });
//   } catch (error) {
//     res.status(400).json({ success: false, error: error.message });
//   }
// };

// exports.approveLeaveRequest = async (req, res) => {
//   try {
//     const leaveRequest = await LeaveRequest.findById(req.params.id);
//     if (!leaveRequest) {
//       return res.status(404).json({ success: false, error: 'Leave request not found' });
//     }
//     if (req.user.role === 'Manager' && req.user.companyId.toString() !== leaveRequest.companyId.toString()) {
//       return res.status(403).json({ success: false, error: 'Company access denied' });
//     }
//     leaveRequest.status = 'approved';
//     leaveRequest.approverId = req.user.employeeId;
//     await leaveRequest.save();
//     res.status(200).json({ success: true, data: leaveRequest });
//   } catch (error) {
//     res.status(400).json({ success: false, error: error.message });
//   }
// };

// exports.denyLeaveRequest = async (req, res) => {
//   try {
//     const leaveRequest = await LeaveRequest.findById(req.params.id);
//     if (!leaveRequest) {
//       return res.status(404).json({ success: false, error: 'Leave request not found' });
//     }
//     if (req.user.role === 'Manager' && req.user.companyId.toString() !== leaveRequest.companyId.toString()) {
//       return res.status(403).json({ success: false, error: 'Company access denied' });
//     }
//     leaveRequest.status = 'denied';
//     leaveRequest.approverId = req.user.employeeId;
//     await leaveRequest.save();
//     res.status(200).json({ success: true, data: leaveRequest });
//   } catch (error) {
//     res.status(400).json({ success: false, error: error.message });
//   }
// };

// exports.getLeaveRequests = async (req, res) => {
//   try {
//     const query = req.user.role === 'Employee' ? { employeeId: req.user.employeeId, companyId: req.user.companyId } : 
//                  req.user.role === 'Manager' ? { companyId: req.user.companyId } : {};
//     const leaveRequests = await LeaveRequest.find(query).populate('employeeId', 'fullName newEmployeeCode');
//     res.status(200).json({ success: true, data: leaveRequests });
//   } catch (error) {
//     res.status(400).json({ success: false, error: error.message });
//   }
// };


const LeaveRequest = require('../models/leaveRequest');
const EmployeesAttendance = require('../models/EmployeesAttendance');
const Employee = require('../models/employee');
const moment = require('moment-timezone');

exports.createLeaveRequest = async (req, res) => {
  try {
    const { startDate, endDate, type, isHalfDay } = req.body;
    if (!startDate || !endDate || !type) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const employee = await Employee.findById(req.user.employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }

    // Parse dates as YYYY-MM-DD in UTC
    const start = moment.utc(startDate, 'YYYY-MM-DD', true).startOf('day').toDate();
    const end = moment.utc(endDate, 'YYYY-MM-DD', true).startOf('day').toDate();

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid date format. Use YYYY-MM-DD' });
    }
    if (start > end) {
      return res.status(400).json({ success: false, error: 'startDate must be before or equal to endDate' });
    }

    // Check for existing leave requests in the date range
    const existingLeave = await LeaveRequest.findOne({
      employeeId: req.user.employeeId,
      $or: [
        { startDate: { $lte: end }, endDate: { $gte: start } }
      ]
    });
    if (existingLeave) {
      return res.status(400).json({ success: false, error: 'Leave request already exists for the specified date range' });
    }

    // Check for weekend or holiday in EmployeesAttendance
    let currentDate = new Date(start);
    const endDateLoop = new Date(end); // Renamed to avoid conflict
    while (currentDate <= endDateLoop) {
      const normalizedDate = moment.utc(currentDate).startOf('day').toDate();
      const attendance = await EmployeesAttendance.findOne({
        employeeId: req.user.employeeId,
        date: normalizedDate,
        status: { $in: ['Weekend', 'Holiday'] }
      });
      if (attendance) {
        return res.status(400).json({ 
          success: false, 
          error: `Cannot request leave on ${normalizedDate.toISOString().split('T')[0]}: marked as ${attendance.status}` 
        });
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const leaveRequest = new LeaveRequest({
      companyId: req.user.companyId,
      employeeId: req.user.employeeId,
      startDate: start,
      endDate: end,
      type,
      isHalfDay,
      approverId: employee.managerId // Automatically set to employee's manager
    });
    await leaveRequest.save();
    console.log(`✅ Created leave request: employeeId: ${req.user.employeeId}, startDate: ${start.toISOString()}, endDate: ${end.toISOString()}`);
    res.status(201).json({ success: true, data: leaveRequest });
  } catch (error) {
    console.error(`❌ Error creating leave request: ${error.message}`);
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.approveLeaveRequest = async (req, res) => {
  try {
    const leaveRequest = await LeaveRequest.findById(req.params.id);
    if (!leaveRequest) {
      return res.status(404).json({ success: false, error: 'Leave request not found' });
    }
    if (req.user.role === 'Manager' && req.user.companyId.toString() !== leaveRequest.companyId.toString()) {
      return res.status(403).json({ success: false, error: 'Company access denied' });
    }
    leaveRequest.status = 'approved';
    leaveRequest.approverId = req.user.employeeId;
    await leaveRequest.save();

    // Update EmployeesAttendance for each date in the range
    const status = leaveRequest.type === 'remote' ? 'Remote' : 'Leave';
    const leave_type = leaveRequest.type === 'remote' ? null : leaveRequest.type;

    let currentDate = new Date(leaveRequest.startDate);
    const endDateLoop = new Date(leaveRequest.endDate); // Renamed to avoid conflict
    while (currentDate <= endDateLoop) {
      const normalizedDate = moment.utc(currentDate).startOf('day').toDate();
      // Check existing attendance to avoid overwriting Present/Incomplete
      const existingAttendance = await EmployeesAttendance.findOne({
        employeeId: leaveRequest.employeeId,
        date: normalizedDate
      });
      if (existingAttendance && ['Present', 'Incomplete'].includes(existingAttendance.status)) {
        console.warn(`⚠️ Skipping attendance update for employeeId: ${leaveRequest.employeeId}, date: ${normalizedDate.toISOString().split('T')[0]}, existing status: ${existingAttendance.status}`);
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }
      const attendance = await EmployeesAttendance.findOneAndUpdate(
        { employeeId: leaveRequest.employeeId, date: normalizedDate },
        { 
          $set: { 
            status, 
            leave_type,
            companyId: leaveRequest.companyId,
            employeeId: leaveRequest.employeeId,
            date: normalizedDate,
            check_in: null,
            check_out: null,
            work_hours: 0
          }
        },
        { upsert: true, new: true }
      );
      console.log(`✅ Updated attendance for employeeId: ${leaveRequest.employeeId}, date: ${normalizedDate.toISOString().split('T')[0]}, status: ${status}, leave_type: ${leave_type}`);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    res.status(200).json({ success: true, data: leaveRequest });
  } catch (error) {
    console.error(`❌ Error approving leave request: ${error.message}`);
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.denyLeaveRequest = async (req, res) => {
  try {
    const leaveRequest = await LeaveRequest.findById(req.params.id);
    if (!leaveRequest) {
      return res.status(404).json({ success: false, error: 'Leave request not found' });
    }
    if (req.user.role === 'Manager' && req.user.companyId.toString() !== leaveRequest.companyId.toString()) {
      return res.status(403).json({ success: false, error: 'Company access denied' });
    }
    leaveRequest.status = 'denied';
    leaveRequest.approverId = req.user.employeeId;
    await leaveRequest.save();
    console.log(`✅ Denied leave request: id: ${req.params.id}, employeeId: ${leaveRequest.employeeId}`);
    res.status(200).json({ success: true, data: leaveRequest });
  } catch (error) {
    console.error(`❌ Error denying leave request: ${error.message}`);
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.getLeaveRequests = async (req, res) => {
  try {
    const query = req.user.role === 'Employee' 
      ? { employeeId: req.user.employeeId, companyId: req.user.companyId } 
      : req.user.role === 'Manager' 
      ? { approverId: req.user.employeeId, companyId: req.user.companyId } 
      : { companyId: req.user.companyId };
    const leaveRequests = await LeaveRequest.find(query)
      .populate('employeeId', 'fullName newEmployeeCode')
      .populate('approverId', 'fullName');
    console.log(`✅ Retrieved ${leaveRequests.length} leave requests for user: ${req.user.employeeId}, role: ${req.user.role}`);
    res.status(200).json({ success: true, data: leaveRequests });
  } catch (error) {
    console.error(`❌ Error retrieving leave requests: ${error.message}`);
    res.status(400).json({ success: false, error: error.message });
  }
};