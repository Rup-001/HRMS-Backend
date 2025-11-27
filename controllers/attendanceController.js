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
//       return res.status(400).json({ success: false, error: 'Invalid date format.' });
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
//       if (employeeQuery._id && !searchIds.includes(employeeQuery._id.toString())) {
//         return res.status(200).json({ success: true, data: [], totals: {} });
//       }
//       if (!employeeQuery._id) employeeQuery._id = { $in: searchIds };
//     }

//     if (userRole === 'Employee') {
//       employeeQuery._id = req.user.employeeId;
//     } else if (userRole === 'Manager') {
//       const managed = await Employee.find({ managerId: req.user.employeeId, companyId }).select('_id');
//       const allowedIds = [req.user.employeeId.toString(), ...managed.map(m => m._id.toString())];
//       if (employeeQuery._id && !allowedIds.includes(employeeQuery._id.toString())) {
//         return res.status(403).json({ success: false, error: 'Access Denied.' });
//       }
//       if (!employeeQuery._id) employeeQuery._id = { $in: allowedIds };
//     }

//     // 3. Fetch Data
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

//     const startYear = start.year();
//     const endYear = end.year();
//     const years = [];
//     for (let y = startYear; y <= endYear; y++) years.push(y);

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

//     // Maps
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

//     // 4. Build Final Records
//     const finalAttendance = [];
//     let currentDay = start.clone();

//     while (currentDay.isSameOrBefore(end)) {
//       const dateStr = currentDay.format('YYYY-MM-DD');

//       const isHoliday = holidays.some(h => {
//         const hStart = moment(h.startDate).startOf('day');
//         const hEnd = h.endDate ? moment(h.endDate).endOf('day') : hStart.clone();
//         return currentDay.isBetween(hStart, hEnd, 'day', '[]');
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
//           shift: employee.shiftId ? {
//             name: employee.shiftId.name,
//             startTime: employee.shiftId.startTime,
//             endTime: employee.shiftId.endTime,
//             workingHours: employee.shiftId.workingHours || 8,
//             gracePeriod: employee.shiftId.gracePeriod || 0,
//             overtimeThreshold: employee.shiftId.overtimeThreshold || 0,
//           } : null
//         };

//         // Apply raw punch data
//         if (rec) {
//           record.check_in = rec.check_in ? moment(rec.check_in).tz('Asia/Dhaka').format('HH:mm:ss') : null;
//           record.check_out = rec.check_out ? moment(rec.check_out).tz('Asia/Dhaka').format('HH:mm:ss') : null;
//           record.status = rec.check_out ? 'Present' : 'Incomplete';
//         }

//         // Holiday & Leave override
//         if (isHoliday && record.status === 'Absent') {
//           record.status = 'Holiday';
//         }
//         if (leave && ['Absent', 'Holiday'].includes(record.status)) {
//           record.status = leave.type === 'remote' ? 'Remote' : 'Leave';
//           record.leave_type = leave.type;
//         }

//         // CALCULATE LATE & OVERTIME FRESH — EVEN ON HOLIDAYS IF PUNCHED!
//         if (record.check_in && employee.shiftId && record.status !== 'Holiday' && record.status !== 'Leave' && record.status !== 'Remote') {
//           const shift = employee.shiftId;
//           const checkInMoment = moment(`${dateStr} ${record.check_in}`, 'YYYY-MM-DD HH:mm:ss').tz('Asia/Dhaka');

//           const [sh, sm] = shift.startTime.split(':').map(Number);
//           const scheduledStart = moment.tz(dateStr, 'Asia/Dhaka').set({ hour: sh, minute: sm, second: 0 });
//           const lateThreshold = scheduledStart.clone().add(shift.gracePeriod || 0, 'minutes');

//           // Late
//           if (checkInMoment.isAfter(lateThreshold)) {
//             record.isLate = true;
//             record.lateBy = checkInMoment.diff(lateThreshold, 'minutes');
//           }

//           // Overtime (only if checkout exists)
//           if (record.check_out) {
//             const checkOutMoment = moment(`${dateStr} ${record.check_out}`, 'YYYY-MM-DD HH:mm:ss').tz('Asia/Dhaka');
//             const workMinutes = checkOutMoment.diff(checkInMoment, 'minutes');
//             record.work_hours = Number((workMinutes / 60).toFixed(2));

//             const expected = shift.workingHours || 8;
//             const thresholdMins = shift.overtimeThreshold || 0;
//             const effectiveThreshold = expected * 60 + thresholdMins;

//             if (workMinutes > effectiveThreshold) {
//               record.isOvertime = true;
//               record.overtimeHours = Number(((workMinutes - effectiveThreshold) / 60).toFixed(2));
//             }
//           }
//         }

//         finalAttendance.push(record);
//       }
//       currentDay.add(1, 'day');
//     }

//     // Totals
//     const totals = {
//       totalRecords: finalAttendance.length,
//       presentDays: finalAttendance.filter(r => r.status === 'Present').length,
//       incompleteDays: finalAttendance.filter(r => r.status === 'Incomplete').length,
//       absentDays: finalAttendance.filter(r => r.status === 'Absent').length,
//       leaveDays: finalAttendance.filter(r => r.status === 'Leave').length,
//       holidayDays: finalAttendance.filter(r => r.status === 'Holiday').length,
//       remoteDays: finalAttendance.filter(r => r.status === 'Remote').length,
//       totalLateMinutes: finalAttendance.reduce((sum, r) => sum + r.lateBy, 0),
//       totalOvertimeHours: finalAttendance.reduce((sum, r) => sum + r.overtimeHours, 0)
//     };

//     res.status(200).json({ success: true, data: finalAttendance, totals });

//   } catch (error) {
//     console.error('Error in getAttendance:', error);
//     res.status(500).json({ success: false, error: 'Server Error' });
//   }
// };


// CRITICAL: Load full timezone data once at startup (fixes VM crash!)
require('moment-timezone').tz.load(require('moment-timezone/data/packed/latest.json'));

exports.getAttendance = async (req, res) => {
  try {
    let { employeeId, startDate, endDate, search } = req.query;
    const { companyId, role, employeeId: userEmployeeId } = req.user;

    // Default: current month in Dhaka time
    const now = moment.tz('Asia/Dhaka');
    const defaultStart = startDate ? moment.tz(startDate, 'Asia/Dhaka') : now.clone().startOf('month');
    const defaultEnd = endDate ? moment.tz(endDate, 'Asia/Dhaka') : now.clone().endOf('month');

    let start = defaultStart.clone().startOf('day');
    let end = defaultEnd.clone().endOf('day');

    if (!start.isValid() || !end.isValid()) {
      return res.status(400).json({ success: false, error: 'Invalid date format.' });
    }
    if (start.isAfter(end)) {
      return res.status(400).json({ success: false, error: 'Start date cannot be after end date.' });
    }

    // Role-based employee filtering
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

    // Role restrictions
    if (role === 'Employee') {
      employeeQuery._id = userEmployeeId;
    } else if (role === 'Manager') {
      const managed = await Employee.find({ managerId: userEmployeeId, companyId }).select('_id');
      const allowedIds = [userEmployeeId.toString(), ...managed.map(m => m._id.toString())];

      if (employeeQuery._id && !allowedIds.includes(employeeQuery._id.toString())) {
        return res.status(403).json({ success: false, error: 'Access Denied.' });
      }
      if (!employeeQuery._id) employeeQuery._id = { $in: allowedIds };
    }

    // Fetch employees with shift
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
    const years = [];
    for (let y = start.year(); y <= end.year(); y++) years.push(y);

    const holidayCalendars = await HolidayCalendar.find({ companyId, year: { $in: years } }).lean();
    const holidays = holidayCalendars.flatMap(cal => cal.holidays);

    const [rawAttendance, leaves] = await Promise.all([
      EmployeesAttendance.find({
        employeeId: { $in: employeeIds },
        date: { $gte: start.toDate(), $lte: end.toDate() }
      }).lean(),
      LeaveRequest.find({
        employeeId: { $in: employeeIds },
        status: 'approved',
        $or: [
          { startDate: { $lte: end.toDate() }, endDate: { $gte: start.toDate() } }
        ]
      }).lean()
    ]);

    // Build maps
    const attendanceMap = new Map()
  rawAttendance.forEach((record) => {
  const dateKey = moment(record.date).tz('Asia/Dhaka').format('YYYY-MM-DD');
  const key = `${record.employeeId}_${dateKey}`;
  attendanceMap.set(key, record);
});

    const leaveMap = new Map();
    leaves.forEach(lr => {
      let cur = moment(lr.startDate).tz('Asia/Dhaka').startOf('day');
      const endLeave = moment(lr.endDate).tz('Asia/Dhaka').endOf('day');
      while (cur.isSameOrBefore(endLeave, 'day')) {
        leaveMap.set(`${lr.employeeId}_${cur.format('YYYY-MM-DD')}`, lr);
        cur.add(1, 'day');
      }
    });

    const finalAttendance = [];
    let currentDay = start.clone();

    while (currentDay.isSameOrBefore(end)) {
      const dateStr = currentDay.format('YYYY-MM-DD');

      const isHoliday = holidays.some(h => {
        const hStart = moment(h.startDate).startOf('day');
        const hEnd = h.endDate ? moment(h.endDate).endOf('day') : hStart;
        return currentDay.isBetween(hStart, hEnd, 'day', '[]');
      });

      for (const emp of employees) {
        const empId = emp._id.toString();
        const key = `${empId}_${dateStr}`;
        const punch = attendanceMap.get(key);
        const leave = leaveMap.get(key);

        const record = {
          employeeId: empId,
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

        if (punch) {
          record.check_in = punch.check_in
            ? moment(punch.check_in).tz('Asia/Dhaka').format('HH:mm:ss')
            : null;
          record.check_out = punch.check_out
            ? moment(punch.check_out).tz('Asia/Dhaka').format('HH:mm:ss')
            : null;

          record.status = punch.check_out ? 'Present' : 'Incomplete';
          record.work_hours = punch.work_hours ? Number(punch.work_hours.toFixed(2)) : 0;
        }

        // Apply leave/holiday
        if (isHoliday && !['Present', 'Incomplete'].includes(record.status)) {
          record.status = 'Holiday';
        }
        if (leave) {
          record.status = leave.type === 'remote' ? 'Remote' : 'Leave';
          record.leave_type = leave.type;
        }

        // Late & Overtime calculation
        if (record.check_in && emp.shiftId && ['Present', 'Incomplete'].includes(record.status)) {
          const shift = emp.shiftId;
          const [sh, sm] = shift.startTime.split(':').map(Number);
          const scheduledStart = currentDay.clone().set({ hour: sh, minute: sm, second: 0 });
          const lateThreshold = scheduledStart.clone().add(shift.gracePeriod || 0, 'minutes');
          const checkInTime = moment(`${dateStr} ${record.check_in}`, 'YYYY-MM-DD HH:mm:ss').tz('Asia/Dhaka');

          if (checkInTime.isAfter(lateThreshold)) {
            record.isLate = true;
            record.lateBy = checkInTime.diff(lateThreshold, 'minutes');
          }

          if (record.check_out) {
            const checkOutTime = moment(`${dateStr} ${record.check_out}`, 'YYYY-MM-DD HH:mm:ss').tz('Asia/Dhaka');
            const workMinutes = checkOutTime.diff(checkInTime, 'minutes');
            record.work_hours = Number((workMinutes / 60).toFixed(2));

            const expectedMins = (shift.workingHours || 8) * 60 + (shift.overtimeThreshold || 0);
            if (workMinutes > expectedMins) {
              record.isOvertime = true;
              record.overtimeHours = Number(((workMinutes - expectedMins) / 60).toFixed(2));
            }
          }
        }

        finalAttendance.push(record);
      }
      currentDay.add(1, 'day');
    }

    const totals = {
      totalRecords: finalAttendance.length,
      presentDays: finalAttendance.filter(r => r.status === 'Present').length,
      incompleteDays: finalAttendance.filter(r => r.status === 'Incomplete').length,
      absentDays: finalAttendance.filter(r => r.status === 'Absent').length,
      leaveDays: finalAttendance.filter(r => r.status === 'Leave').length,
      holidayDays: finalAttendance.filter(r => r.status === 'Holiday').length,
      remoteDays: finalAttendance.filter(r => r.status === 'Remote').length,
      totalLateMinutes: finalAttendance.reduce((sum, r) => sum + r.lateBy, 0),
      totalOvertimeHours: finalAttendance.reduce((sum, r) => sum + r.overtimeHours, 0).toFixed(2)
    };

    res.status(200).json({
      success: true,
      data: finalAttendance,
      totals,
      timezone: 'Asia/Dhaka',
      note: 'All times are in Bangladesh Time (UTC+6)'
    });

  } catch (error) {
    console.error('getAttendance Error:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};


exports.getEmployeeAttendance = async (req, res) => {
  try {
    let { startDate, endDate, employeeId } = req.query;

    const now = moment.tz('Asia/Dhaka');
    const defaultStart = now.clone().startOf('month').toDate();
    const defaultEnd = now.clone().endOf('month').toDate();

    const start = startDate
      ? moment.tz(startDate, 'Asia/Dhaka').startOf('day').toDate()
      : defaultStart;
    const end = endDate
      ? moment.tz(endDate, 'Asia/Dhaka').endOf('day').toDate()
      : defaultEnd;

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid date format' });
    }
    if (start > end) {
      return res.status(400).json({ success: false, error: 'startDate must be before endDate' });
    }

    const query = { date: { $gte: start, $lte: end } };
    if (employeeId) query.employeeId = employeeId;

    const attendanceRecords = await EmployeesAttendance.find(query)
      .populate({
        path: 'employeeId',
        select: 'newEmployeeCode fullName deviceUserId shiftId',
        populate: {
          path: 'shiftId',
          select: 'name startTime endTime gracePeriod overtimeThreshold workingHours'
        }
      })
      .sort({ date: -1 })
      .lean();

    // === FETCH ALL EMPLOYEES IF NO SPECIFIC employeeId ===
    let allEmployees = [];
    if (!employeeId) {
      const Employee = require('../models/employee');
      allEmployees = await Employee.find({})
        .select('newEmployeeCode fullName deviceUserId shiftId')
        .populate({
          path: 'shiftId',
          select: 'name startTime endTime gracePeriod overtimeThreshold workingHours'
        })
        .lean();
    }

    const dateMap = new Map();
    let current = moment.tz(start, 'Asia/Dhaka').startOf('day');
    const endMoment = moment.tz(end, 'Asia/Dhaka').endOf('day');

    while (current <= endMoment) {
      dateMap.set(current.format('YYYY-MM-DD'), null);
      current.add(1, 'day');
    }

    const timeToMinutes = (timeStr) => {
      if (!timeStr) return null;
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };

    // USE UTC MINUTES FOR CALCULATION
    const dateToMinutes = (date) => {
      if (!date) return null;
      const d = new Date(date);
      return d.getUTCHours() * 60 + d.getUTCMinutes();
    };

    const formatMinutes = (mins) => {
      if (!mins || mins <= 0) return '0 mins';
      if (mins < 60) return `${mins} mins`;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${h}.${m.toString().padStart(2, '0')} hr`;
    };

    // === PROCESS EXISTING RECORDS ===
    for (const rec of attendanceRecords) {
      const emp = rec.employeeId;
      if (!emp) continue;

      const shift = emp.shiftId || {
        name: 'No Shift',
        startTime: '00:00',
        endTime: '00:00',
        gracePeriod: 0,
        overtimeThreshold: 0,
        workingHours: 0
      };

      const dateStr = moment(rec.date).tz('Asia/Dhaka').format('YYYY-MM-DD');

      const shiftStart = timeToMinutes(shift.startTime);
      const shiftEnd = timeToMinutes(shift.endTime);
      const grace = shift.gracePeriod || 0;
      const otThreshold = shift.overtimeThreshold || 0;
      const expectedMins = shift.workingHours * 60;

      const inMins = rec.check_in ? dateToMinutes(rec.check_in) : null;
      const outMins = rec.check_out ? dateToMinutes(rec.check_out) : null;

      let lateMins = 0;
      let earlyMins = 0;
      let otMins = 0;

      if (inMins !== null && shiftStart !== null) {
        const lateThreshold = shiftStart + grace;
        if (inMins > lateThreshold) {
          lateMins = inMins - shiftStart;
        }
      }

      if (outMins !== null && shiftEnd !== null && outMins < shiftEnd) {
        earlyMins = shiftEnd - outMins;
      }

      let workMins = 0;
      if (inMins !== null && outMins !== null) {
        workMins = outMins - inMins;
        if (workMins <= 0) workMins += 24 * 60;
      }

      if (workMins > expectedMins + otThreshold) {
        otMins = workMins - expectedMins;
      }

      dateMap.set(dateStr, {
        employeeId: emp._id,
        employeeCode: emp.newEmployeeCode,
        fullName: emp.fullName,
        deviceUserId: emp.deviceUserId,
        date: dateStr,
        // UTC ISO FORMAT — NO LOCAL CONVERSION
        check_in: rec.check_in ? rec.check_in.toISOString() : null,
        check_out: rec.check_out ? rec.check_out.toISOString() : null,
        work_hours: rec.work_hours ? Number(rec.work_hours.toFixed(2)) : 0,
        status: rec.status || 'Present',
        leave_type: rec.leave_type,
        isLate: lateMins > 0,
        lateBy: formatMinutes(lateMins),
        isEarlyDeparture: earlyMins > 0,
        earlyDepartureBy: formatMinutes(earlyMins),
        isOvertime: otMins > 0,
        overtimeHours: formatMinutes(otMins),
        shift: {
          name: shift.name,
          startTime: shift.startTime,
          endTime: shift.endTime,
          workingHours: shift.workingHours,
          gracePeriod: shift.gracePeriod,
          overtimeThreshold: shift.overtimeThreshold
        }
      });
    }

    // === FILL MISSING DATES ===
    const result = [];

    for (const [date, record] of dateMap) {
      if (record) {
        result.push(record);
        continue;
      }

      // === CASE 1: Specific Employee ===
      if (employeeId) {
        let emp = attendanceRecords[0]?.employeeId;
        if (!emp) {
          const Employee = require('../models/employee');
          emp = await Employee.findById(employeeId)
            .select('newEmployeeCode fullName deviceUserId shiftId')
            .populate({
              path: 'shiftId',
              select: 'name startTime endTime gracePeriod overtimeThreshold workingHours'
            })
            .lean();
        }
        if (emp) {
          const shift = emp.shiftId || {
            name: 'No Shift',
            startTime: '00:00',
            endTime: '00:00',
            workingHours: 0
          };
          result.push({
            employeeId: emp._id,
            employeeCode: emp.newEmployeeCode,
            fullName: emp.fullName,
            deviceUserId: emp.deviceUserId,
            date,
            check_in: null,
            check_out: null,
            work_hours: 0,
            status: 'Absent',
            leave_type: null,
            isLate: false,
            lateBy: '0 mins',
            isEarlyDeparture: false,
            earlyDepartureBy: '0 mins',
            isOvertime: false,
            overtimeHours: '0 mins',
            shift: {
              name: shift.name,
              startTime: shift.startTime,
              endTime: shift.endTime,
              workingHours: shift.workingHours
            }
          });
        }
      }

      // === CASE 2: All Employees ===
      else {
        for (const emp of allEmployees) {
          const shift = emp.shiftId || {
            name: 'No Shift',
            startTime: '00:00',
            endTime: '00:00',
            workingHours: 0
          };
          result.push({
            employeeId: emp._id,
            employeeCode: emp.newEmployeeCode,
            fullName: emp.fullName,
            deviceUserId: emp.deviceUserId,
            date,
            check_in: null,
            check_out: null,
            work_hours: 0,
            status: 'Absent',
            leave_type: null,
            isLate: false,
            lateBy: '0 mins',
            isEarlyDeparture: false,
            earlyDepartureBy: '0 mins',
            isOvertime: false,
            overtimeHours: '0 mins',
            shift: {
              name: shift.name,
              startTime: shift.startTime,
              endTime: shift.endTime,
              workingHours: shift.workingHours
            }
          });
        }
      }
    }

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Error in getEmployeeAttendance:', error);
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

// exports.getAdjustmentRequests = async (req, res) => {
//   try {
//     let query = { companyId: req.user.companyId };

//     if (req.user.role === 'Employee') {
//       query.employeeId = req.user.employeeId;
//     } else if (req.user.role === 'Manager') {
//       query.managerApproverId = req.user.employeeId;
//       // Managers can see all requests where they are the approver, regardless of status
//     } else if (req.user.role === 'HR Manager') {
//       // HR Managers can see all requests
//     } else if (req.user.role === 'Super Admin') {
//       delete query.companyId; // Super Admin sees all across all companies
//     }

//     const requests = await AttendanceAdjustmentRequest.find(query)
//       .populate('employeeId', 'fullName newEmployeeCode')
//       .populate('managerApproverId', 'fullName');

//     res.status(200).json({ success: true, data: requests });
//   } catch (error) {
//     console.error(`❌ Error getting adjustment requests: ${error.message}`);
//     res.status(400).json({ success: false, error: error.message });
//   }
// };


// controllers/attendanceAdjustmentController.js (or wherever you have it)

exports.getAdjustmentRequests = async (req, res) => {
  try {
    let query = {};

    // Role-based visibility
    if (req.user.role === 'Employee') {
      // Employee sees only his/her own requests
      query.employeeId = req.user.employeeId;
    } 
    else if (req.user.role === 'Manager') {
      // Manager sees only requests where he/she is the approver
      query.managerApproverId = req.user.employeeId;
    } 
    else if (req.user.role === 'HR Manager') {
      // HR Manager sees ALL requests across the system
      // No filter → query remains {}
    } 
    else if (['Super Admin', 'Company Admin', 'C-Level Executive'].includes(req.user.role)) {
      // Admins / C-Level see everything
      // No filter → query remains {}
    } 
    else {
      // Fallback: deny access for any unexpected role
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const requests = await AttendanceAdjustmentRequest.find(query)
      .populate('employeeId', 'fullName newEmployeeCode')
      .populate('managerApproverId', 'fullName')
      .sort({ createdAt: -1 }); // newest first

    res.status(200).json({ success: true, data: requests });
  } catch (error) {
    console.error(`Error fetching adjustment requests: ${error.message}`);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};