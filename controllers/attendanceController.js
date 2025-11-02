const EmployeesAttendance = require('../models/EmployeesAttendance');
const AttendanceAdjustmentRequest = require('../models/attendanceAdjustmentRequest');
const moment = require('moment-timezone');
const Log = require('../models/log');
const Employee = require('../models/employee');


exports.getAttendance = async (req, res) => {
  try {
    const { employeeId, startDate, endDate } = req.query;
    const query = req.user.role === 'Employee' || req.user.role === 'Manager' ? { companyId: req.user.companyId } : {};
    if (employeeId) {
      query.employeeId = employeeId;
      if (req.user.role === 'Employee' && req.user.employeeId.toString() !== employeeId) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
    }
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = moment.tz(startDate, 'Asia/Dhaka').startOf('day').toDate();
      }
      if (endDate) {
        query.date.$lte = moment.tz(endDate, 'Asia/Dhaka').endOf('day').toDate();
      }
    }

    const attendance = await EmployeesAttendance.find(query)
      .populate('employeeId', 'newEmployeeCode fullName')
      .sort({ date: 1, employeeId: 1 });

    const result = attendance.map(record => ({
      employeeId: record.employeeId._id,
      employeeCode: record.employeeId.newEmployeeCode,
      fullName: record.employeeId.fullName,
      date: moment(record.date).tz('Asia/Dhaka').format('YYYY-MM-DD'),
      check_in: record.check_in ? moment(record.check_in).tz('Asia/Dhaka').format('YYYY-MM-DD HH:mm:ss') : null,
      check_out: record.check_out ? moment(record.check_out).tz('Asia/Dhaka').format('YYYY-MM-DD HH:mm:ss') : null,
      work_hours: record.work_hours ? record.work_hours.toFixed(2) : null,
      status: record.status,
      leave_type: record.leave_type
    }));

    const totals = {
      totalRecords: result.length,
      presentDays: result.filter(r => r.status === 'Present').length,
      incompleteDays: result.filter(r => r.status === 'Incomplete').length,
      absentDays: result.filter(r => r.status === 'Absent').length,
      weekendDays: result.filter(r => r.status === 'Weekend').length,
      leaveDays: result.filter(r => r.status === 'Leave').length,
      holidayDays: result.filter(r => r.status === 'Holiday').length,
      remoteDays: result.filter(r => r.status === 'Remote').length
    };

    res.status(200).json({ success: true, data: result, totals });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};




// exports.getEmployeeAttendance = async (req, res) => {
//   try {
//     const { period = 'daily', date } = req.query;
//     const targetDate = date ? moment(date, 'YYYY-MM-DD') : moment();
//     let startDate, endDate;

//     // Set date range based on period
//     if (period === 'monthly') {
//       startDate = targetDate.clone().startOf('month').toDate();
//       endDate = targetDate.clone().endOf('month').toDate();
//     } else {
//       startDate = targetDate.clone().startOf('day').toDate();
//       endDate = targetDate.clone().endOf('day').toDate();
//     }

//     // Fetch all employees
//     const employees = await Employee.find({}, 'deviceUserId fullName').lean();

//     // Fetch logs within date range
//     const logs = await Log.find({
//       timestamp: { $gte: startDate, $lte: endDate }
//     }).lean();

//     // Process attendance
//     const attendance = employees.map(employee => {
//       const employeeLogs = logs.filter(log => log.user_id === employee.deviceUserId);
//       let checkIn, checkOut, status;

//       if (employeeLogs.length === 0) {
//         status = 'Absent';
//       } else {
//         // Assume type: 0 = check-in, 1 = check-out (adjust based on zkteco-js output)
//         checkIn = employeeLogs.find(log => log.type === 0)?.timestamp;
//         checkOut = employeeLogs.find(log => log.type === 1)?.timestamp;
//         status = checkIn ? 'Present' : 'Incomplete';
        
//         // Check for late arrival (e.g., after 9 AM)
//         if (checkIn && moment(checkIn).hour() >= 9) {
//           status = 'Late';
//         }
//       }

//       return {
//         employeeId: employee._id,
//         fullName: employee.fullName,
//         deviceUserId: employee.deviceUserId,
//         checkIn: checkIn ? moment(checkIn).format('YYYY-MM-DD HH:mm:ss') : null,
//         checkOut: checkOut ? moment(checkOut).format('YYYY-MM-DD HH:mm:ss') : null,
//         status
//       };
//     });

//     res.status(200).json({ success: true, data: attendance });
//   } catch (error) {
//     console.error('Error fetching attendance:', error);
//     res.status(400).json({ success: false, error: error.message });
//   }
// };



exports.getEmployeeAttendance = async (req, res) => {
  try {
    let { startDate, endDate, employeeId } = req.query;

    // Default to current month
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const start = startDate ? new Date(startDate) : defaultStart;
    const end = endDate ? new Date(endDate) : defaultEnd;

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid date format' });
    }
    if (start > end) {
      return res.status(400).json({ success: false, error: 'startDate must be before endDate' });
    }

    // Set end time to end of day
    end.setHours(23, 59, 59, 999);

    // Fetch employees
    const employeeQuery = employeeId ? { _id: employeeId } : {};
    const employees = await Employee.find(employeeQuery).select('deviceUserId fullName companyId').lean();
    if (employees.length === 0) {
      return res.status(404).json({ success: false, error: 'No matching employee(s) found' });
    }

    // Generate date range
    const dates = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d));
    }

    // Process attendance for each employee
    const report = await Promise.all(employees.map(async (employee) => {
      const attendance = await Promise.all(dates.map(async (date) => {
        const shiftStart = new Date(date);
        shiftStart.setHours(0, 0, 0, 0); // Start of day
        const shiftEnd = new Date(date);
        shiftEnd.setHours(23, 59, 59, 999); // End of day

        const attendanceRecord = await EmployeesAttendance.findOne({
          employeeId: employee._id,
          date: { $gte: shiftStart, $lte: shiftEnd }
        }).lean();

        if (!attendanceRecord) {
          return {
            date: date.toISOString().split('T')[0],
            check_in: '',
            check_out: '',
            work_hours: 0,
            status: 'Absent'
          };
        }

        const formatTime = (time) => {
          if (!time) return '';
          const date = new Date(time);
          return isNaN(date.getTime()) ? '' : date.toTimeString().slice(0, 5);
        };

        return {
          date: date.toISOString().split('T')[0],
          check_in: formatTime(attendanceRecord.check_in),
          check_out: formatTime(attendanceRecord.check_out),
          work_hours: attendanceRecord.work_hours || 0,
          status: attendanceRecord.status || 'Absent'
        };
      }));

      return {
        employeeId: employee._id,
        fullName: employee.fullName || `Employee_${employee.deviceUserId}`,
        deviceUserId: employee.deviceUserId,
        attendance
      };
    }));

    res.status(200).json({ success: true, data: report });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.createAdjustmentRequest = async (req, res) => {
  try {
    const { attendanceDate, proposedCheckIn, proposedCheckOut, reason } = req.body;
    if (!attendanceDate || !reason || (!proposedCheckIn && !proposedCheckOut)) {
      return res.status(400).json({ success: false, error: 'Missing required fields: attendanceDate, reason, and at least one of proposedCheckIn/proposedCheckOut' });
    }

    const employee = await Employee.findById(req.user.employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }
    // if (!employee.managerId) {
    //   return res.status(400).json({ success: false, error: 'Employee does not have an assigned manager for approval' });
    // }
    const manager = await Employee.findById(employee.managerId);
if (!manager || !['Manager', 'C-Level Executive', 'HR Manager', 'Company Admin', 'Super Admin'].includes(manager.role)) {
  return res.status(400).json({ success: false, error: 'No valid manager assigned for approval' });
}

    const targetDate = moment.utc(attendanceDate, 'YYYY-MM-DD').startOf('day').toDate();

    const existingRequest = await AttendanceAdjustmentRequest.findOne({
      employeeId: employee._id,
      attendanceDate: targetDate
    });

    if (existingRequest) {
      return res.status(400).json({ success: false, error: 'An adjustment request for this date has already been submitted.' });
    }

    const existingAttendance = await EmployeesAttendance.findOne({
      employeeId: employee._id,
      date: targetDate
    });

    const originalCheckIn = existingAttendance ? existingAttendance.check_in : null;
    const originalCheckOut = existingAttendance ? existingAttendance.check_out : null;

    const newRequest = new AttendanceAdjustmentRequest({
      companyId: req.user.companyId,
      employeeId: employee._id,
      attendanceDate: targetDate,
      originalCheckIn,
      originalCheckOut,
      proposedCheckIn: proposedCheckIn ? moment.utc(proposedCheckIn).toDate() : null,
      proposedCheckOut: proposedCheckOut ? moment.utc(proposedCheckOut).toDate() : null,
      reason,
      managerApproverId: employee.managerId,
    });

    await newRequest.save();
    res.status(201).json({ success: true, data: newRequest });
  } catch (error) {
    console.error(`❌ Error creating attendance adjustment request: ${error.message}`);
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.managerReviewAdjustment = async (req, res) => {
  try {
    const { id } = req.params; // Request ID
    const { status, managerComment } = req.body; // 'approved' or 'denied_by_manager'

    if (!['approved', 'denied_by_manager'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status for manager review' });
    }

    const request = await AttendanceAdjustmentRequest.findById(id);
    if (!request) {
      return res.status(404).json({ success: false, error: 'Adjustment request not found' });
    }

    // Ensure the manager is the assigned approver for this request
    // if (request.managerApproverId.toString() !== req.user.employeeId.toString()) {
    const reviewer = await Employee.findById(req.user.employeeId);
if (request.managerApproverId.toString() !== req.user.employeeId.toString() || 
    !['Manager', 'C-Level Executive', 'HR Manager', 'Company Admin', 'Super Admin'].includes(reviewer.role)) {
      return res.status(403).json({ success: false, error: 'You are not authorized to review this request' });
    }
    if (request.status !== 'pending_manager_approval') {
      return res.status(400).json({ success: false, error: `Request already ${request.status}` });
    }

    request.status = (status === 'approved') ? 'pending_hr_approval' : 'denied_by_manager';
    request.managerApprovalDate = new Date();
    request.managerComment = managerComment;
    // For HR Approver: find an HR manager in the company
    if (status === 'approved') {
      // const hrManager = await Employee.findOne({ companyId: req.user.companyId, role: 'HR Manager' });
      const hrManager = await Employee.findOne({  role: 'HR Manager' });
      if (hrManager) {
        request.hrApproverId = hrManager._id;
      } else {
        // Fallback if no specific HR Manager is found, potentially needs a Super Admin
        const superAdmin = await Employee.findOne({ role: 'Super Admin' });
        if (superAdmin) request.hrApproverId = superAdmin._id;
        else console.warn('⚠️ No HR Manager or Super Admin found for HR approval process.');
      }
    }

    await request.save();
    res.status(200).json({ success: true, data: request });
  } catch (error) {
    console.error(`❌ Error reviewing adjustment request by manager: ${error.message}`);
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.hrReviewAdjustment = async (req, res) => {
  try {
    const { id } = req.params; // Request ID
    const { status, hrComment } = req.body; // 'approved' or 'denied_by_hr'

    if (!['approved', 'denied_by_hr'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status for HR review' });
    }

    const request = await AttendanceAdjustmentRequest.findById(id);
    if (!request) {
      return res.status(404).json({ success: false, error: 'Adjustment request not found' });
    }

    // Ensure HR user is authorized (either the assigned HR, or any HR if hrApproverId is general)
    // For simplicity, for now, any HR Manager in the company can approve/deny if hrApproverId isn't set
    const isAuthorizedHR = (request.hrApproverId && request.hrApproverId.toString() === req.user.employeeId.toString()) ||
                           req.user.role === 'HR Manager' || req.user.role === 'Super Admin' || req.user.role === 'Company Admin';
    
    if (!isAuthorizedHR) {
      return res.status(403).json({ success: false, error: 'You are not authorized to review this request' });
    }
    if (request.status !== 'pending_hr_approval') {
      return res.status(400).json({ success: false, error: `Request already ${request.status}` });
    }

    request.status = status;
    request.hrApprovalDate = new Date();
    request.hrComment = hrComment;

    if (status === 'approved') {
      // Update the actual EmployeesAttendance record
      const attendance = await EmployeesAttendance.findOneAndUpdate(
        { employeeId: request.employeeId, date: request.attendanceDate },
        { 
          $set: {
            check_in: request.proposedCheckIn,
            check_out: request.proposedCheckOut,
            // Recalculate work_hours if both are present
            work_hours: (request.proposedCheckIn && request.proposedCheckOut)
                          ? (moment(request.proposedCheckOut).diff(moment(request.proposedCheckIn), 'minutes') / 60) 
                          : 0,
            status: (request.proposedCheckIn || request.proposedCheckOut) ? 'Present' : 'Absent', // Assuming any check-in implies present
          }
        },
        { upsert: true, new: true }
      );
      console.log(`✅ Attendance record updated for employee ${request.employeeId} on ${moment(request.attendanceDate).format('YYYY-MM-DD')}`);
    }

    await request.save();
    res.status(200).json({ success: true, data: request });
  } catch (error) {
    console.error(`❌ Error reviewing adjustment request by HR: ${error.message}`);
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.getAdjustmentRequests = async (req, res) => {
  try {
    let query = { companyId: req.user.companyId };

    if (req.user.role === 'Employee') {
      query.employeeId = req.user.employeeId;
    } else if (req.user.role === 'Manager') {
      query.managerApproverId = req.user.employeeId;
      query.status = 'pending_manager_approval'; // Managers only see their pending approvals
    } else if (req.user.role === 'HR Manager') {
      query.status = 'pending_hr_approval'; // HR Managers only see requests pending HR approval
    } else if (req.user.role === 'Super Admin') {
      delete query.companyId; // Super Admin sees all across all companies
    }

    const requests = await AttendanceAdjustmentRequest.find(query)
      .populate('employeeId', 'fullName newEmployeeCode')
      .populate('managerApproverId', 'fullName')
      .populate('hrApproverId', 'fullName');

    res.status(200).json({ success: true, data: requests });
  } catch (error) {
    console.error(`❌ Error getting adjustment requests: ${error.message}`);
    res.status(400).json({ success: false, error: error.message });
  }
};