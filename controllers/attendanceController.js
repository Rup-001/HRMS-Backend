const EmployeesAttendance = require('../models/employeesAttendance');
const AttendanceAdjustmentRequest = require('../models/attendanceAdjustmentRequest');
const moment = require('moment-timezone');
const Employee = require('../models/employee');
const HolidayCalendar = require('../models/holidayCalendar'); // Import HolidayCalendar model
const LeaveRequest = require('../models/leaveRequest'); // Import LeaveRequest model

// exports.getAttendance = async (req, res) => {
//   try {
//     // 1. Extract and Validate Query Parameters
//     let { employeeId, startDate, endDate, search } = req.query;
//     const { companyId } = req.user;
//     const userRole = req.user.role;

//     const now = moment.tz('Asia/Dhaka');
//     const defaultStart = now.clone().startOf('month');
//     const defaultEnd = now.clone().endOf('month');

//     let start = startDate ? moment.tz(startDate, 'Asia/Dhaka').startOf('day') : defaultStart;
//     let end = endDate ? moment.tz(endDate, 'Asia/Dhaka').endOf('day') : defaultEnd;

//     if (!start.isValid() || !end.isValid()) {
//       return res.status(400).json({ success: false, error: 'Invalid date format. Use YYYY-MM-DD.' });
//     }
//     if (start.isAfter(end)) {
//       return res.status(400).json({ success: false, error: 'Start date cannot be after end date.' });
//     }

//     // 2. Role-based Employee Filtering
//     let employeeQuery = { companyId };
//     if (employeeId) employeeQuery._id = employeeId;
    
//     if (search) {
//       const searchEmployees = await Employee.find({ 
//         fullName: { $regex: search, $options: 'i' }, 
//         companyId 
//       }).select('_id');
//       const searchIds = searchEmployees.map(e => e._id.toString());
//       if (employeeQuery._id) {
//           if (!searchIds.includes(employeeQuery._id.toString())) {
//               return res.status(200).json({ success: true, data: [], totals: {} });
//           }
//       } else {
//         employeeQuery._id = { $in: searchIds };
//       }
//     }

//     if (userRole === 'Employee') {
//       employeeQuery._id = req.user.employeeId;
//     } else if (userRole === 'Manager') {
//       const managed = await Employee.find({ managerId: req.user.employeeId, companyId }).select('_id');
//       const allowedIds = [req.user.employeeId.toString(), ...managed.map(m => m._id.toString())];
      
//       if (employeeQuery._id) {
//         if (!allowedIds.includes(employeeQuery._id.toString())) {
//           return res.status(403).json({ success: false, error: 'Access Denied.' });
//         }
//       } else {
//         employeeQuery._id = { $in: allowedIds };
//       }
//     }

//     // 3. Fetch Data
//     const employees = await Employee.find(employeeQuery).populate('shiftId').lean();
//     if (employees.length === 0) {
//       return res.status(200).json({ success: true, data: [], totals: {} });
//     }
//     const employeeIds = employees.map(e => e._id);
    
//     const startYear = start.year();
//     const endYear = end.year();
//     const years = [];
//     for (let y = startYear; y <= endYear; y++) {
//       years.push(y);
//     }
//     const holidayCalendars = await HolidayCalendar.find({ companyId, year: { $in: years } }).lean();
//     const holidays = holidayCalendars.flatMap(cal => cal.holidays);

//     const [rawAttendanceRecords, leaveRequests] = await Promise.all([
//       EmployeesAttendance.find({
//         employeeId: { $in: employeeIds },
//         date: { $gte: start.toDate(), $lte: end.toDate() }
//       }).lean(),
//       LeaveRequest.find({
//         employeeId: { $in: employeeIds },
//         status: 'approved',
//         startDate: { $lte: end.toDate() },
//         endDate: { $gte: start.toDate() }
//       }).lean()
//     ]);
    
//     // Maps for quick lookup
//     const attendanceMap = new Map();
//     rawAttendanceRecords.forEach(rec => {
//       const dateKey = moment(rec.date).tz('Asia/Dhaka').format('YYYY-MM-DD');
//       attendanceMap.set(`${rec.employeeId}_${dateKey}`, rec);
//     });

//     const leaveMap = new Map();
//     leaveRequests.forEach(lr => {
//       let cur = moment(lr.startDate).tz('Asia/Dhaka').startOf('day');
//       const endLeave = moment(lr.endDate).tz('Asia/Dhaka').endOf('day');
//       while (cur.isSameOrBefore(endLeave, 'day')) {
//         leaveMap.set(`${lr.employeeId}_${cur.format('YYYY-MM-DD')}`, lr);
//         cur.add(1, 'day');
//       }
//     });

//     // 4. Build Final Attendance Records
//     const finalAttendance = [];
//     let currentDay = start.clone();
//     while (currentDay.isSameOrBefore(end)) {
//       const dateStr = currentDay.format('YYYY-MM-DD');

//       const isHoliday = holidays.some(h => {
//         const holidayStart = moment(h.startDate).startOf('day');
//         const holidayEnd = h.endDate ? moment(h.endDate).endOf('day') : holidayStart.clone().endOf('day');
//         return currentDay.isBetween(holidayStart, holidayEnd, 'day', '[]');
//       });

//       for (const employee of employees) {
//         const empIdStr = employee._id.toString();
//         const key = `${empIdStr}_${dateStr}`;
//         const rec = attendanceMap.get(key);
//         const leave = leaveMap.get(key);

//         const record = {
//           employeeId: empIdStr,
//           employeeCode: employee.newEmployeeCode || employee.employeeCode,
//           fullName: employee.fullName,
//           date: dateStr,
//           status: 'Absent',
//           check_in: null, check_out: null, work_hours: 0, leave_type: null,
//           isLate: false, lateBy: 0, isEarlyDeparture: false, earlyDepartureBy: 0, isOvertime: false, overtimeHours: 0,
//           shift: employee.shiftId || null
//         };
        
//         if (rec) {
//             Object.assign(record, {
//                 check_in: rec.check_in ? moment(rec.check_in).tz('Asia/Dhaka').format('HH:mm:ss') : null,
//                 check_out: rec.check_out ? moment(rec.check_out).tz('Asia/Dhaka').format('HH:mm:ss') : null,
//                 status: rec.status,
//                 leave_type: rec.leave_type,
//                 work_hours: rec.work_hours || 0,
//                 isLate: rec.isLate || false,
//                 lateBy: rec.lateBy || 0,
//                 isEarlyDeparture: rec.isEarlyDeparture || false,
//                 earlyDepartureBy: rec.earlyDepartureBy || 0,
//                 isOvertime: rec.isOvertime || false,
//                 overtimeHours: rec.overtimeHours || 0,
//             });
//         }
        
//         if (isHoliday && record.status === 'Absent') {
//             record.status = 'Holiday';
//         }
        
//         if (leave && ['Absent', 'Holiday'].includes(record.status)) {
//           record.status = leave.type === 'remote' ? 'Remote' : 'Leave';
//           record.leave_type = leave.type;
//         }
        
//         finalAttendance.push(record);
//       }
//       currentDay.add(1, 'day');
//     }

//     // 6. Totals
//     const totals = {
//       totalRecords: finalAttendance.length,
//       presentDays: finalAttendance.filter(r => r.status === 'Present').length,
//       incompleteDays: finalAttendance.filter(r => r.status === 'Incomplete').length,
//       absentDays: finalAttendance.filter(r => r.status === 'Absent').length,
//       leaveDays: finalAttendance.filter(r => r.status === 'Leave').length,
//       holidayDays: finalAttendance.filter(r => r.status === 'Holiday').length,
//       remoteDays: finalAttendance.filter(r => r.status === 'Remote').length,
//       totalLateMinutes: finalAttendance.reduce((sum, r) => sum + (r.isLate ? r.lateBy : 0), 0),
//       totalOvertimeHours: finalAttendance.reduce((sum, r) => sum + (r.isOvertime ? r.overtimeHours : 0), 0)
//     };

//     res.status(200).json({ success: true, data: finalAttendance, totals });

//   } catch (error) {
//     console.error('Error in getAttendance:', error);
//     res.status(500).json({ success: false, error: 'Internal Server Error' });
//   }
// };


exports.getAttendance = async (req, res) => {
  try {
    // 1. Extract and Validate Query Parameters
    let { employeeId, startDate, endDate, search } = req.query;
    const { companyId } = req.user;
    const userRole = req.user.role;

    const now = moment.tz('Asia/Dhaka');
    const defaultStart = now.clone().startOf('month');
    const defaultEnd = now.clone().endOf('month');

    let start = startDate ? moment.tz(startDate, 'Asia/Dhaka').startOf('day') : defaultStart;
    let end = endDate ? moment.tz(endDate, 'Asia/Dhaka').endOf('day') : defaultEnd;

    if (!start.isValid() || !end.isValid()) {
      return res.status(400).json({ success: false, error: 'Invalid date format.' });
    }
    if (start.isAfter(end)) {
      return res.status(400).json({ success: false, error: 'Start date cannot be after end date.' });
    }

    // 2. Role-based Employee Filtering
    let employeeQuery = { companyId };
    if (employeeId) employeeQuery._id = employeeId;

    if (search) {
      const searchEmployees = await Employee.find({
        fullName: { $regex: search, $options: 'i' },
        companyId
      }).select('_id');
      const searchIds = searchEmployees.map(e => e._id.toString());
      if (employeeQuery._id && !searchIds.includes(employeeQuery._id.toString())) {
        return res.status(200).json({ success: true, data: [], totals: {} });
      }
      if (!employeeQuery._id) employeeQuery._id = { $in: searchIds };
    }

    if (userRole === 'Employee') {
      employeeQuery._id = req.user.employeeId;
    } else if (userRole === 'Manager') {
      const managed = await Employee.find({ managerId: req.user.employeeId, companyId }).select('_id');
      const allowedIds = [req.user.employeeId.toString(), ...managed.map(m => m._id.toString())];
      if (employeeQuery._id && !allowedIds.includes(employeeQuery._id.toString())) {
        return res.status(403).json({ success: false, error: 'Access Denied.' });
      }
      if (!employeeQuery._id) employeeQuery._id = { $in: allowedIds };
    }

    // 3. Fetch Data
    const employees = await Employee.find(employeeQuery)
      .populate({
        path: 'shiftId',
        select: 'name startTime endTime workingHours gracePeriod overtimeThreshold'
      })
      .lean();

    if (employees.length === 0) {
      return res.status(200).json({ success: true, data: [], totals: {} });
    }

    const employeeIds = employees.map(e => e._id);

    const startYear = start.year();
    const endYear = end.year();
    const years = [];
    for (let y = startYear; y <= endYear; y++) years.push(y);

    const holidayCalendars = await HolidayCalendar.find({ companyId, year: { $in: years } }).lean();
    const holidays = holidayCalendars.flatMap(cal => cal.holidays);

    const [rawAttendanceRecords, leaveRequests] = await Promise.all([
      EmployeesAttendance.find({
        employeeId: { $in: employeeIds },
        date: { $gte: start.toDate(), $lte: end.toDate() }
      }).lean(),
      LeaveRequest.find({
        employeeId: { $in: employeeIds },
        status: 'approved',
        startDate: { $lte: end.toDate() },
        endDate: { $gte: start.toDate() }
      }).lean()
    ]);

    // Maps
    const attendanceMap = new Map();
    rawAttendanceRecords.forEach(rec => {
      const dateKey = moment(rec.date).tz('Asia/Dhaka').format('YYYY-MM-DD');
      attendanceMap.set(`${rec.employeeId}_${dateKey}`, rec);
    });

    const leaveMap = new Map();
    leaveRequests.forEach(lr => {
      let cur = moment(lr.startDate).tz('Asia/Dhaka').startOf('day');
      const endLeave = moment(lr.endDate).tz('Asia/Dhaka').endOf('day');
      while (cur.isSameOrBefore(endLeave, 'day')) {
        leaveMap.set(`${lr.employeeId}_${cur.format('YYYY-MM-DD')}`, lr);
        cur.add(1, 'day');
      }
    });

    // 4. Build Final Records
    const finalAttendance = [];
    let currentDay = start.clone();

    while (currentDay.isSameOrBefore(end)) {
      const dateStr = currentDay.format('YYYY-MM-DD');

      const isHoliday = holidays.some(h => {
        const hStart = moment(h.startDate).startOf('day');
        const hEnd = h.endDate ? moment(h.endDate).endOf('day') : hStart.clone();
        return currentDay.isBetween(hStart, hEnd, 'day', '[]');
      });

      for (const employee of employees) {
        const empIdStr = employee._id.toString();
        const key = `${empIdStr}_${dateStr}`;
        const rec = attendanceMap.get(key);
        const leave = leaveMap.get(key);

        const record = {
          employeeId: empIdStr,
          employeeCode: employee.newEmployeeCode || employee.employeeCode,
          fullName: employee.fullName,
          date: dateStr,
          check_in: null,
          check_out: null,
          work_hours: 0,
          status: 'Absent',
          leave_type: null,
          isLate: false,
          lateBy: 0,
          isEarlyDeparture: false,
          earlyDepartureBy: 0,
          isOvertime: false,
          overtimeHours: 0,
          shift: employee.shiftId ? {
            name: employee.shiftId.name,
            startTime: employee.shiftId.startTime,
            endTime: employee.shiftId.endTime,
            workingHours: employee.shiftId.workingHours || 8,
            gracePeriod: employee.shiftId.gracePeriod || 0,
            overtimeThreshold: employee.shiftId.overtimeThreshold || 0,
          } : null
        };

        // Apply raw punch data
        if (rec) {
          record.check_in = rec.check_in ? moment(rec.check_in).tz('Asia/Dhaka').format('HH:mm:ss') : null;
          record.check_out = rec.check_out ? moment(rec.check_out).tz('Asia/Dhaka').format('HH:mm:ss') : null;
          record.status = rec.check_out ? 'Present' : 'Incomplete';
        }

        // Holiday & Leave override
        if (isHoliday && record.status === 'Absent') {
          record.status = 'Holiday';
        }
        if (leave && ['Absent', 'Holiday'].includes(record.status)) {
          record.status = leave.type === 'remote' ? 'Remote' : 'Leave';
          record.leave_type = leave.type;
        }

        // CALCULATE LATE & OVERTIME FRESH — EVEN ON HOLIDAYS IF PUNCHED!
        if (record.check_in && employee.shiftId && record.status !== 'Holiday' && record.status !== 'Leave' && record.status !== 'Remote') {
          const shift = employee.shiftId;
          const checkInMoment = moment(`${dateStr} ${record.check_in}`, 'YYYY-MM-DD HH:mm:ss').tz('Asia/Dhaka');

          const [sh, sm] = shift.startTime.split(':').map(Number);
          const scheduledStart = moment.tz(dateStr, 'Asia/Dhaka').set({ hour: sh, minute: sm, second: 0 });
          const lateThreshold = scheduledStart.clone().add(shift.gracePeriod || 0, 'minutes');

          // Late
          if (checkInMoment.isAfter(lateThreshold)) {
            record.isLate = true;
            record.lateBy = checkInMoment.diff(lateThreshold, 'minutes');
          }

          // Overtime (only if checkout exists)
          if (record.check_out) {
            const checkOutMoment = moment(`${dateStr} ${record.check_out}`, 'YYYY-MM-DD HH:mm:ss').tz('Asia/Dhaka');
            const workMinutes = checkOutMoment.diff(checkInMoment, 'minutes');
            record.work_hours = Number((workMinutes / 60).toFixed(2));

            const expected = shift.workingHours || 8;
            const thresholdMins = shift.overtimeThreshold || 0;
            const effectiveThreshold = expected * 60 + thresholdMins;

            if (workMinutes > effectiveThreshold) {
              record.isOvertime = true;
              record.overtimeHours = Number(((workMinutes - effectiveThreshold) / 60).toFixed(2));
            }
          }
        }

        finalAttendance.push(record);
      }
      currentDay.add(1, 'day');
    }

    // Totals
    const totals = {
      totalRecords: finalAttendance.length,
      presentDays: finalAttendance.filter(r => r.status === 'Present').length,
      incompleteDays: finalAttendance.filter(r => r.status === 'Incomplete').length,
      absentDays: finalAttendance.filter(r => r.status === 'Absent').length,
      leaveDays: finalAttendance.filter(r => r.status === 'Leave').length,
      holidayDays: finalAttendance.filter(r => r.status === 'Holiday').length,
      remoteDays: finalAttendance.filter(r => r.status === 'Remote').length,
      totalLateMinutes: finalAttendance.reduce((sum, r) => sum + r.lateBy, 0),
      totalOvertimeHours: finalAttendance.reduce((sum, r) => sum + r.overtimeHours, 0)
    };

    res.status(200).json({ success: true, data: finalAttendance, totals });

  } catch (error) {
    console.error('Error in getAttendance:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};



exports.getEmployeeAttendance = async (req, res) => {
  console.log('🕵️‍♂️ [JAMES BOND] Received request for getEmployeeAttendance');
  try {
    const { employeeId, startDate, endDate } = req.query;
    console.log('🕵️‍♂️ [JAMES BOND] Request Query Params:', { employeeId, startDate, endDate });

    // Base query
    const query = {};

    // Filter by employee if provided
    if (employeeId) {
      query.employeeId = employeeId;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = moment.tz(startDate, 'Asia/Dhaka').startOf('day').toDate();
      }
      if (endDate) {
        query.date.$lte = moment.tz(endDate, 'Asia/Dhaka').endOf('day').toDate();
      }
    } else {
      // Default to current month if no dates are provided
      console.log('🕵️‍♂️ [JAMES BOND] No dates provided, defaulting to current month.');
      const now = moment.tz('Asia/Dhaka');
      query.date = {
        $gte: now.clone().startOf('month').toDate(),
        $lte: now.clone().endOf('month').toDate()
      };
    }

    console.log('🕵️‍♂️ [JAMES BOND] Executing MongoDB query with:', JSON.stringify(query, null, 2));

    const attendance = await EmployeesAttendance.find(query)
      .populate('employeeId', 'newEmployeeCode fullName deviceUserId')
      .sort({ date: -1 }) // Sort by most recent date first
      .lean();

    console.log(`🕵️‍♂️ [JAMES BOND] MongoDB returned ${attendance.length} records.`);

    if (attendance.length === 0) {
        console.log('🕵️‍♂️ [JAMES BOND] Returning empty data array as no records were found.');
        return res.status(200).json({ success: true, data: [] });
    }

    const result = attendance.map(record => ({
      ...record, // Spread the original record
      employeeId: record.employeeId?._id,
      employeeCode: record.employeeId?.newEmployeeCode,
      fullName: record.employeeId?.fullName,
      deviceUserId: record.employeeId?.deviceUserId,
      // Format dates and times consistently
      date: moment(record.date).tz('Asia/Dhaka').format('YYYY-MM-DD'),
      check_in: record.check_in ? moment(record.check_in).tz('Asia/Dhaka').format('YYYY-MM-DD HH:mm:ss') : null,
      check_out: record.check_out ? moment(record.check_out).tz('Asia/Dhaka').format('YYYY-MM-DD HH:mm:ss') : null,
      work_hours: record.work_hours != null ? Number(record.work_hours) : null,
      overtimeHours: record.overtimeHours != null ? Number(record.overtimeHours) : 0,
    }));
    
    console.log(`🕵️‍♂️ [JAMES BOND] Sending ${result.length} processed records to frontend.`);
    res.status(200).json({ success: true, data: result });

  } catch (error) {
    console.error('🕵️‍♂️ [JAMES BOND] !! ERROR !! in getEmployeeAttendance:', error);
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

    request.status = (status === 'approved') ? 'approved' : 'denied_by_manager';
    request.managerApprovalDate = new Date();
    request.managerComment = managerComment;
    // For HR Approver: find an HR manager in the company
    // if (status === 'approved') {
    //   // const hrManager = await Employee.findOne({ companyId: req.user.companyId, role: 'HR Manager' });
    //   const hrManager = await Employee.findOne({  role: 'HR Manager' });
    //   if (hrManager) {
    //     request.hrApproverId = hrManager._id;
    //   } else {
    //     // Fallback if no specific HR Manager is found, potentially needs a Super Admin
    //     const superAdmin = await Employee.findOne({ role: 'Super Admin' });
    //     if (superAdmin) request.hrApproverId = superAdmin._id;
    //     else console.warn('⚠️ No HR Manager or Super Admin found for HR approval process.');
    //   }
    // }

    await request.save();
    res.status(200).json({ success: true, data: request });
  } catch (error) {
    console.error(`❌ Error reviewing adjustment request by manager: ${error.message}`);
    res.status(400).json({ success: false, error: error.message });
  }
};

// exports.hrReviewAdjustment = async (req, res) => {
//   try {
//     const { id } = req.params; // Request ID
//     const { status, hrComment } = req.body; // 'approved' or 'denied_by_hr'

//     if (!['approved', 'denied_by_hr'].includes(status)) {
//       return res.status(400).json({ success: false, error: 'Invalid status for HR review' });
//     }

//     const request = await AttendanceAdjustmentRequest.findById(id);
//     if (!request) {
//       return res.status(404).json({ success: false, error: 'Adjustment request not found' });
//     }

//     // Ensure HR user is authorized (either the assigned HR, or any HR if hrApproverId is general)
//     // For simplicity, for now, any HR Manager in the company can approve/deny if hrApproverId isn't set
//     const isAuthorizedHR = (request.hrApproverId && request.hrApproverId.toString() === req.user.employeeId.toString()) ||
//                            req.user.role === 'HR Manager' || req.user.role === 'Super Admin' || req.user.role === 'Company Admin';
    
//     if (!isAuthorizedHR) {
//       return res.status(403).json({ success: false, error: 'You are not authorized to review this request' });
//     }
//     if (request.status !== 'pending_hr_approval') {
//       return res.status(400).json({ success: false, error: `Request already ${request.status}` });
//     }

//     request.status = status;
//     request.hrApprovalDate = new Date();
//     request.hrComment = hrComment;

//     if (status === 'approved') {
//       // Update the actual EmployeesAttendance record
//       const attendance = await EmployeesAttendance.findOneAndUpdate(
//         { employeeId: request.employeeId, date: request.attendanceDate },
//         { 
//           $set: {
//             check_in: request.proposedCheckIn,
//             check_out: request.proposedCheckOut,
//             // Recalculate work_hours if both are present
//             work_hours: (request.proposedCheckIn && request.proposedCheckOut)
//                           ? (moment(request.proposedCheckOut).diff(moment(request.proposedCheckIn), 'minutes') / 60) 
//                           : 0,
//             status: (request.proposedCheckIn || request.proposedCheckOut) ? 'Present' : 'Absent', // Assuming any check-in implies present
//           }
//         },
//         { upsert: true, new: true }
//       );
//       console.log(`✅ Attendance record updated for employee ${request.employeeId} on ${moment(request.attendanceDate).format('YYYY-MM-DD')}`);
//     }

//     await request.save();
//     res.status(200).json({ success: true, data: request });
//   } catch (error) {
//     console.error(`❌ Error reviewing adjustment request by HR: ${error.message}`);
//     res.status(400).json({ success: false, error: error.message });
//   }
// };

exports.getAdjustmentRequests = async (req, res) => {
  try {
    let query = { companyId: req.user.companyId };

    if (req.user.role === 'Employee') {
      query.employeeId = req.user.employeeId;
    } else if (req.user.role === 'Manager') {
      query.managerApproverId = req.user.employeeId;
      // Managers can see all requests where they are the approver, regardless of status
    } else if (req.user.role === 'HR Manager') {
      // HR Managers can see all requests
    } else if (req.user.role === 'Super Admin') {
      delete query.companyId; // Super Admin sees all across all companies
    }

    const requests = await AttendanceAdjustmentRequest.find(query)
      .populate('employeeId', 'fullName newEmployeeCode')
      .populate('managerApproverId', 'fullName');

    res.status(200).json({ success: true, data: requests });
  } catch (error) {
    console.error(`❌ Error getting adjustment requests: ${error.message}`);
    res.status(400).json({ success: false, error: error.message });
  }
};