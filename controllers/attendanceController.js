const EmployeesAttendance = require('../models/employeesAttendance');
const AttendanceAdjustmentRequest = require('../models/attendanceAdjustmentRequest');
const moment = require('moment-timezone');
const Employee = require('../models/employee');
const HolidayCalendar = require('../models/holidayCalendar'); // Import HolidayCalendar model
const LeaveRequest = require('../models/leaveRequest'); // Import LeaveRequest model

// exports.getAttendance = async (req, res) => {
//   try {
//     let { employeeId, startDate, endDate, search } = req.query;
//     const { companyId, role: userRole, employeeId: userEmployeeId } = req.user;

//     // Default to current month in UTC
//     const now = moment.utc();
//     const defaultStart = now.clone().startOf('month').startOf('day');
//     const defaultEnd = now.clone().endOf('month').startOf('day');

//     let start = startDate
//       ? moment.utc(startDate).startOf('day')
//       : defaultStart;

//     let end = endDate
//       ? moment.utc(endDate).endOf('day')
//       : defaultEnd;

//     if (!start.isValid() || !end.isValid() || start.isAfter(end)) {
//       return res.status(400).json({ success: false, error: 'Invalid date range' });
//     }

//     // Super Admin sees ALL companies
//     const isSuperAdmin = userRole === 'Super Admin';
//     const baseCompanyFilter = isSuperAdmin ? {} : { companyId };

//     // Build employee filter
//     let employeeQuery = { ...baseCompanyFilter };
//     if (employeeId) employeeQuery._id = employeeId;

//     // Search by name
//     if (search) {
//       const matchedEmps = await Employee.find({
//         ...baseCompanyFilter,
//         fullName: { $regex: search, $options: 'i' }
//       }).select('_id');

//       const ids = matchedEmps.map(e => e._id);

//       if (ids.length === 0) {
//         return res.status(200).json({ success: true, data: [], totals: {} });
//       }

//       employeeQuery._id = employeeQuery._id
//         ? { $and: [{ _id: employeeQuery._id }, { _id: { $in: ids } }] }
//         : { $in: ids };
//     }

//     // Role-based access
//     if (userRole === 'Employee') {
//       employeeQuery._id = userEmployeeId;
//     } else if (userRole === 'Manager') {
//       const managed = await Employee.find({
//         managerId: userEmployeeId,
//         ...baseCompanyFilter
//       }).select('_id');

//       const allowedIds = [userEmployeeId, ...managed.map(m => m._id)];

//       if (employeeQuery._id && !allowedIds.includes(employeeQuery._id)) {
//         return res.status(403).json({ success: false, error: 'Access denied' });
//       }
//       employeeQuery._id = { $in: allowedIds };
//     }

//     const employees = await Employee.find(employeeQuery)
//       .populate({
//         path: 'shiftId',
//         select: 'name startTime endTime workingHours gracePeriod overtimeThreshold'
//       })
//       .lean();

//     if (employees.length === 0) {
//       return res.status(200).json({ success: true, data: [], totals: {} });
//     }

//     const employeeIds = employees.map(e => e._id);

//     // Fetch holidays (Super Admin = all companies)
//     const years = [];
//     for (let y = start.year(); y <= end.year(); y++) years.push(y);

//     const holidayCalendars = await HolidayCalendar.find(
//       isSuperAdmin ? { year: { $in: years } } : { companyId, year: { $in: years } }
//     ).lean();

//     const holidays = holidayCalendars.flatMap(cal => cal.holidays || []);

//     // Fetch attendance & approved leaves
//     const [rawAttendance, leaves] = await Promise.all([
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

//     // Build lookup maps using UTC date string (YYYY-MM-DD)
//     const attendanceMap = new Map();
//     rawAttendance.forEach(rec => {
//       const dateKey = moment.utc(rec.date).format('YYYY-MM-DD');
//       attendanceMap.set(`${rec.employeeId}_${dateKey}`, rec);
//     });

//     const leaveMap = new Map();
//     leaves.forEach(leave => {
//       let cur = moment.utc(leave.startDate).startOf('day');
//       const endL = moment.utc(leave.endDate).endOf('day');
//       while (cur <= endL) {
//         const key = cur.format('YYYY-MM-DD');
//         leaveMap.set(`${leave.employeeId}_${key}`, leave);
//         cur.add(1, 'day');
//       }
//     });

//     // Generate records for every day in range
//     const records = [];
//     let current = start.clone();

//     while (current <= end) {
//       // const dateStr = current.format('YYYY-MM-DD'); // UTC YYYY-MM-DD

//       // const isHoliday = holidays.some(h => {
//       //   const hStart = moment.utc(h.startDate).startOf('day');
//       //   const hEnd = h.endDate ? moment.utc(h.endDate).endOf('day') : hStart;
//       //   return current.isSameOrBetween(hStart, hEnd, 'day', '[]');
//             const dateStr = current.format('YYYY-MM-DD'); // UTC YYYY-MM-DD

//       const isHoliday = holidays.some(h => {
//         const hStart = moment.utc(h.startDate).startOf('day');
//         const hEnd = moment.utc(h.endDate || h.startDate).endOf('day');
//         return current >= hStart && current <= hEnd;
//       });
      

//       for (const emp of employees) {
//         const key = `${emp._id}_${dateStr}`;
//         const punch = attendanceMap.get(key);
//         const leave = leaveMap.get(key);

//         const r = {
//           employeeId: emp._id.toString(),
//           employeeCode: emp.newEmployeeCode || emp.employeeCode || '',
//           fullName: emp.fullName,
//           date: dateStr,
//           check_in: null,
//           check_out: null,
//           work_hours: 0,
//           status: 'Absent',
//           leave_type: null,
//           isLate: false,
//           lateBy: 0,
//           isEarlyDeparture: false,
//           earlyDepartureBy: 0,
//           isOvertime: false,
//           overtimeHours: 0,
//           shift: emp.shiftId
//             ? {
//                 name: emp.shiftId.name,
//                 startTime: emp.shiftId.startTime,
//                 endTime: emp.shiftId.endTime,
//                 workingHours: emp.shiftId.workingHours || 8,
//                 gracePeriod: emp.shiftId.gracePeriod || 0,
//                 overtimeThreshold: emp.shiftId.overtimeThreshold || 0,
//               }
//             : null
//         };

//         if (punch) {
//           r.check_in = punch.check_in ? moment.utc(punch.check_in).format('HH:mm:ss') : null;
//           r.check_out = punch.check_out ? moment.utc(punch.check_out).format('HH:mm:ss') : null;
//           r.status = punch.check_out ? 'Present' : 'Incomplete';
//         }

//         if (isHoliday && r.status === 'Absent') r.status = 'Holiday';

//         if (leave && ['Absent', 'Holiday'].includes(r.status)) {
//           r.status = leave.type === 'remote' ? 'Remote' : 'Leave';
//           r.leave_type = leave.type;
//         }

//         // Late & Overtime calculation (UTC-based)
//         if (r.check_in && emp.shiftId && !['Holiday', 'Leave', 'Remote'].includes(r.status)) {
//           const shift = emp.shiftId;
//           const [sh, sm] = shift.startTime.split(':').map(Number);

//           const scheduledStartUTC = moment.utc(dateStr).set({ hour: sh, minute: sm, second: 0 });
//           const checkInUTC = moment.utc(`${dateStr} ${r.check_in}`, 'YYYY-MM-DD HH:mm:ss');
//           const lateThreshold = scheduledStartUTC.clone().add(shift.gracePeriod || 0, 'minutes');

//           if (checkInUTC.isAfter(lateThreshold)) {
//             r.isLate = true;
//             r.lateBy = checkInUTC.diff(lateThreshold, 'minutes');
//           }

//           if (r.check_out) {
//             const checkOutUTC = moment.utc(`${dateStr} ${r.check_out}`, 'YYYY-MM-DD HH:mm:ss');
//             const workedMins = checkOutUTC.diff(checkInUTC, 'minutes');
//             r.work_hours = Number((workedMins / 60).toFixed(2));

//             const expectedMins = (shift.workingHours || 8) * 60 + (shift.overtimeThreshold || 0);
//             if (workedMins > expectedMins) {
//               r.isOvertime = true;
//               r.overtimeHours = Number(((workedMins - expectedMins) / 60).toFixed(2));
//             }
//           }
//         }

//         records.push(r);
//       }

//       current.add(1, 'day');
//     }

//     // Totals
//     const totals = {
//       totalRecords: records.length,
//       presentDays: records.filter(r => r.status === 'Present').length,
//       incompleteDays: records.filter(r => r.status === 'Incomplete').length,
//       absentDays: records.filter(r => r.status === 'Absent').length,
//       leaveDays: records.filter(r => r.status === 'Leave').length,
//       holidayDays: records.filter(r => r.status === 'Holiday').length,
//       remoteDays: records.filter(r => r.status === 'Remote').length,
//       totalLateMinutes: records.reduce((s, r) => s + r.lateBy, 0),
//       totalOvertimeHours: Number(records.reduce((s, r) => s + r.overtimeHours, 0).toFixed(2))
//     };

//     return res.json({ success: true, data: records, totals });

//   } catch (err) {
//     console.error('getAttendance error:', err);
//     return res.status(500).json({ success: false, error: 'Server error' });
//   }
// };


exports.getAttendance = async (req, res) => {
  try {
    let { employeeId, startDate, endDate, search } = req.query;
    const { companyId, role: userRole, employeeId: userEmployeeId } = req.user;

    const now = moment.utc();
    const defaultStart = now.clone().startOf('month').startOf('day');
    const defaultEnd = now.clone().endOf('month').startOf('day');

    let start = startDate ? moment.utc(startDate).startOf('day') : defaultStart;
    let end = endDate ? moment.utc(endDate).endOf('day') : defaultEnd;

    if (!start.isValid() || !end.isValid() || start.isAfter(end)) {
      return res.status(400).json({ success: false, error: 'Invalid date range' });
    }

    const isSuperAdmin = userRole === 'Super Admin';
    const baseCompanyFilter = isSuperAdmin ? {} : { companyId };

    let employeeQuery = { ...baseCompanyFilter };
    if (employeeId) employeeQuery._id = employeeId;

    if (search) {
      const matched = await Employee.find({
        ...baseCompanyFilter,
        fullName: { $regex: search, $options: 'i' }
      }).select('_id');
      const ids = matched.map(e => e._id);
      if (ids.length === 0) return res.json({ success: true, data: [], totals: {} });
      employeeQuery._id = employeeQuery._id
        ? { $and: [{ _id: employeeQuery._id }, { _id: { $in: ids } }] }
        : { $in: ids };
    }

    if (userRole === 'Employee') {
      employeeQuery._id = userEmployeeId;
    } else if (userRole === 'Manager') {
      const managed = await Employee.find({
        managerId: userEmployeeId,
        ...baseCompanyFilter
      }).select('_id');
      const allowed = [userEmployeeId, ...managed.map(m => m._id)];
      if (employeeQuery._id && !allowed.includes(employeeQuery._id)) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      employeeQuery._id = { $in: allowed };
    }

    const employees = await Employee.find(employeeQuery)
      .populate({
        path: 'shiftId',
        select: 'name startTime endTime workingHours gracePeriod overtimeThreshold'
      })
      .lean();

    if (employees.length === 0) {
      return res.json({ success: true, data: [], totals: {} });
    }

    const employeeIds = employees.map(e => e._id);

    const years = [];
    for (let y = start.year(); y <= end.year(); y++) years.push(y);

    const holidayCalendars = await HolidayCalendar.find(
      isSuperAdmin ? { year: { $in: years } } : { companyId, year: { $in: years } }
    ).lean();

    const holidays = holidayCalendars.flatMap(cal => cal.holidays || []);

    const [rawAttendance, leaves] = await Promise.all([
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

    const attendanceMap = new Map();
    rawAttendance.forEach(rec => {
      const key = moment.utc(rec.date).format('YYYY-MM-DD');
      attendanceMap.set(`${rec.employeeId}_${key}`, rec);
    });

    const leaveMap = new Map();
    leaves.forEach(leave => {
      let cur = moment.utc(leave.startDate).startOf('day');
      const endL = moment.utc(leave.endDate).endOf('day');
      while (cur <= endL) {
        leaveMap.set(`${leave.employeeId}_${cur.format('YYYY-MM-DD')}`, leave);
        cur.add(1, 'day');
      }
    });

    const records = [];
    let current = start.clone();

    while (current <= end) {
      const dateStr = current.format('YYYY-MM-DD');

      const isHoliday = holidays.some(h => {
        const hStart = moment.utc(h.startDate).startOf('day');
        const hEnd = moment.utc(h.endDate || h.startDate).endOf('day');
        return current >= hStart && current <= hEnd;
      });

      for (const emp of employees) {
        const key = `${emp._id}_${dateStr}`;
        const punch = attendanceMap.get(key);
        const leave = leaveMap.get(key);

        const r = {
          employeeId: emp._id.toString(),
          employeeCode: emp.newEmployeeCode || emp.employeeCode || '',
          fullName: emp.fullName,
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
          shift: emp.shiftId ? {
            name: emp.shiftId.name,
            startTime: emp.shiftId.startTime,
            endTime: emp.shiftId.endTime,
            workingHours: emp.shiftId.workingHours || 8,
            gracePeriod: emp.shiftId.gracePeriod || 0,
            overtimeThreshold: emp.shiftId.overtimeThreshold || 0,
          } : null
        };

        // FIXED LINE — was missing parentheses!
        if (punch) {
          r.check_in = punch.check_in ? moment.utc(punch.check_in).format('HH:mm:ss') : null;
          r.check_out = punch.check_out ? moment.utc(punch.check_out).format('HH:mm:ss') : null;
          r.status = punch.check_out ? 'Present' : 'Incomplete';
        }

        if (isHoliday && r.status === 'Absent') r.status = 'Holiday';
        if (leave && ['Absent', 'Holiday'].includes(r.status)) {
          r.status = leave.type === 'remote' ? 'Remote' : 'Leave';
          r.leave_type = leave.type;
        }

        // FINAL CORRECT LATE & OVERTIME — ALL IN DHAKA TIME
        if (r.check_in && emp.shiftId && !['Holiday', 'Leave', 'Remote'].includes(r.status)) {
          const shift = emp.shiftId;

          const shiftStart = moment.tz(`${dateStr} ${shift.startTime}`, 'YYYY-MM-DD HH:mm', 'Asia/Dhaka');
          const lateThreshold = shiftStart.clone().add(shift.gracePeriod || 0, 'minutes');
          const checkIn = moment.tz(`${dateStr} ${r.check_in}`, 'YYYY-MM-DD HH:mm:ss', 'Asia/Dhaka');

          if (checkIn.isAfter(lateThreshold)) {
            r.isLate = true;
            r.lateBy = checkIn.diff(lateThreshold, 'minutes'); // Now correct (e.g., 84)
          }

          if (r.check_out) {
            const checkOut = moment.tz(`${dateStr} ${r.check_out}`, 'YYYY-MM-DD HH:mm:ss', 'Asia/Dhaka');
            const workedMins = checkOut.diff(checkIn, 'minutes');
            r.work_hours = Number((workedMins / 60).toFixed(2));

            const expectedMins = (shift.workingHours || 8) * 60 + (shift.overtimeThreshold || 0);
            if (workedMins > expectedMins) {
              r.isOvertime = true;
              r.overtimeHours = Number(((workedMins - expectedMins) / 60).toFixed(2));
            }
          }
        }

        records.push(r);
      }
      current.add(1, 'day');
    }

    const totals = {
      totalRecords: records.length,
      presentDays: records.filter(r => r.status === 'Present').length,
      incompleteDays: records.filter(r => r.status === 'Incomplete').length,
      absentDays: records.filter(r => r.status === 'Absent').length,
      leaveDays: records.filter(r => r.status === 'Leave').length,
      holidayDays: records.filter(r => r.status === 'Holiday').length,
      remoteDays: records.filter(r => r.status === 'Remote').length,
      totalLateMinutes: records.reduce((s, r) => s + r.lateBy, 0),
      totalOvertimeHours: Number(records.reduce((s, r) => s + r.overtimeHours, 0).toFixed(2))
    };

    res.json({ success: true, data: records, totals });

  } catch (err) {
    console.error('getAttendance error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};























exports.getEmployeeAttendance = async (req, res) => {
  console.log('🕵️‍♂️ [BACKEND] Received request for getEmployeeAttendance');
  try {
    const { employeeId, startDate, endDate } = req.query;
    console.log('🕵️‍♂️ [BACKEND] Request Query Params:', { employeeId, startDate, endDate });

    const query = {};

    // Filter by employee if provided
    if (employeeId) {
      query.employeeId = employeeId;
    }

    // Build the date query
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
      console.log('🕵️‍♂️ [BACKEND] No dates provided, defaulting to current month.');
      const now = moment.tz('Asia/Dhaka');
      query.date = {
        $gte: now.clone().startOf('month').toDate(),
        $lte: now.clone().endOf('month').toDate()
      };
    }

    console.log('🕵️‍♂️ [BACKEND] Executing MongoDB query with:', JSON.stringify(query, null, 2));

    const attendance = await EmployeesAttendance.find(query)
      .populate('employeeId', 'newEmployeeCode fullName')
      .sort({ date: -1 })
      .lean();

    console.log(`🕵️‍♂️ [BACKEND] MongoDB returned ${attendance.length} records.`);

    if (attendance.length === 0) {
      console.log('🕵️‍♂️ [BACKEND] Returning empty data array as no records were found.');
      return res.status(200).json({ success: true, data: [] });
    }

    const result = attendance.map(record => ({
      ...record,
      employeeId: record.employeeId?._id,
      employeeCode: record.employeeId?.newEmployeeCode,
      fullName: record.employeeId?.fullName,
      date: moment(record.date).tz('Asia/Dhaka').format('YYYY-MM-DD'),
      check_in: record.check_in ? moment(record.check_in).tz('Asia/Dhaka').format('YYYY-MM-DD HH:mm:ss') : null,
      check_out: record.check_out ? moment(record.check_out).tz('Asia/Dhaka').format('YYYY-MM-DD HH:mm:ss') : null,
      work_hours: record.work_hours != null ? Number(record.work_hours) : null,
      overtimeHours: record.overtimeHours != null ? Number(record.overtimeHours) : 0,
    }));

    console.log(`🕵️‍♂️ [BACKEND] Sending ${result.length} processed records to frontend.`);
    res.status(200).json({ success: true, data: result });

  } catch (error) {
    console.error('🕵️‍♂️ [BACKEND] !! ERROR !! in getEmployeeAttendance:', error);
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

    // const targetDate = moment.utc(attendanceDate, 'YYYY-MM-DD').startOf('day').toDate();
    const targetDate = moment.tz(attendanceDate, 'YYYY-MM-DD', 'Asia/Dhaka').startOf('day').toDate();


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
      // proposedCheckIn: proposedCheckIn ? moment.utc(proposedCheckIn).toDate() : null,
      // proposedCheckOut: proposedCheckOut ? moment.utc(proposedCheckOut).toDate() : null,
      proposedCheckIn: proposedCheckIn ? moment.tz(proposedCheckIn, 'YYYY-MM-DD HH:mm:ss', 'Asia/Dhaka').toDate() : null,
      proposedCheckOut: proposedCheckOut ? moment.tz(proposedCheckOut, 'YYYY-MM-DD HH:mm:ss', 'Asia/Dhaka').toDate() : null,
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