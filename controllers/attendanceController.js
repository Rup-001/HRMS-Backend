const EmployeesAttendance = require('../models/employeesAttendance');
const AttendanceAdjustmentRequest = require('../models/attendanceAdjustmentRequest');
const timezone = require('../utils/timezoneHelper');
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




exports.getAttendance = async (req, res) => {
  try {
    // 1. Extract and Validate Query Parameters
    let { employeeId, startDate, endDate, search } = req.query;
    const { companyId: tokenCompanyId, role: userRole, employeeId: userEmployeeId } = req.user;

    const now = timezone.now();
    const defaultStart = now.clone().startOf('month');
    const defaultEnd = now.clone().endOf('month');

    let start = startDate
      ? timezone.parse(startDate).startOf('day')
      : defaultStart;
    let end = endDate
      ? timezone.parse(endDate).endOf('day')
      : defaultEnd;

    if (!start.isValid() || !end.isValid()) {
      return res.status(400).json({ success: false, error: 'Invalid date format. Use YYYY-MM-DD.' });
    }
    if (start.isAfter(end)) {
      return res.status(400).json({ success: false, error: 'Start date cannot be after end date.' });
    }

    // 2. Build Base Employee Query with Role-Based Access Control
    let employeeQuery = {};

    if (userRole === 'Super Admin') {
      // Super Admin sees ALL employees across ALL companies
      employeeQuery = {}; // No company filter
    } else {
      // All other roles are scoped to their company
      employeeQuery.companyId = tokenCompanyId;

      if (userRole === 'Employee') {
        employeeQuery._id = userEmployeeId;
      } else if (userRole === 'Manager') {
        const managed = await Employee.find({
          managerId: userEmployeeId,
          companyId: tokenCompanyId
        }).select('_id');

        const allowedIds = [
          userEmployeeId.toString(),
          ...managed.map(m => m._id.toString())
        ];

        if (employeeId && !allowedIds.includes(employeeId)) {
          return res.status(403).json({ success: false, error: 'Access Denied: You can only view your team.' });
        }

        if (!employeeId) {
          employeeQuery._id = { $in: allowedIds };
        } else {
          employeeQuery._id = employeeId;
        }
      }
      // HR Manager & Admin (or any other role) → full company access (no further restriction)
    }

    // Apply employeeId filter if provided (except when already set by Manager/Employee logic)
    if (employeeId && !employeeQuery._id) {
      employeeQuery._id = employeeId;
    }

    // Apply search filter
    if (search && search.trim()) {
      const searchEmployees = await Employee.find({
        companyId: userRole === 'Super Admin' ? undefined : tokenCompanyId,
        $or: [
          { fullName: { $regex: search.trim(), $options: 'i' } },
          { employeeCode: { $regex: search.trim(), $options: 'i' } },
          { newEmployeeCode: { $regex: search.trim(), $options: 'i' } }
        ]
      }).select('_id');

      const searchIds = searchEmployees.map(e => e._id.toString());

      if (searchIds.length === 0) {
        return res.status(200).json({ success: true, data: [], totals: {} });
      }

      if (employeeQuery._id) {
        const singleId = employeeQuery._id.toString();
        if (!searchIds.includes(singleId)) {
          return res.status(200).json({ success: true, data: [], totals: {} });
        }
      } else {
        employeeQuery._id = { $in: searchIds };
      }
    }

    // 3. Fetch Employees with Shift Info
    const employees = await Employee.find(employeeQuery)
      .populate({
        path: 'shiftId',
        select: 'name startTime endTime workingHours gracePeriod overtimeThreshold weekendDays'
      })
      .lean();

    if (employees.length === 0) {
      return res.status(200).json({ success: true, data: [], totals: {} });
    }

    const employeeIds = employees.map(e => e._id);

    // 4. Fetch Holidays (all years in range)
    const startYear = start.year();
    const endYear = end.year();
    const years = [];
    for (let y = startYear; y <= endYear; y++) years.push(y);

    const holidayCalendars = await HolidayCalendar.find({
      ...(userRole !== 'Super Admin' && { companyId: tokenCompanyId }),
      year: { $in: years }
    }).lean();

    const holidays = holidayCalendars.flatMap(cal => cal.holidays || []);

    // 5. Fetch Attendance & Approved Leaves
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

    // 6. Build Maps for Fast Lookup
    const attendanceMap = new Map();
    rawAttendanceRecords.forEach(rec => {
      const dateKey = timezone.formatDate(rec.date);
      attendanceMap.set(`${rec.employeeId}_${dateKey}`, rec);
    });

    const leaveMap = new Map();
    leaveRequests.forEach(lr => {
      let cur = timezone.startOfDay(lr.startDate);
      const endLeave = timezone.endOfDay(lr.endDate);
      while (cur.isSameOrBefore(endLeave, 'day')) {
        const dateKey = cur.format('YYYY-MM-DD');
        leaveMap.set(`${lr.employeeId}_${dateKey}`, lr);
        cur.add(1, 'day');
      }
    });

    // 7. Generate Attendance Records Day by Day
    const finalAttendance = [];
    let currentDay = start.clone();

    while (currentDay.isSameOrBefore(end, 'day')) {
      const dateStr = currentDay.format('YYYY-MM-DD');

      const isHoliday = holidays.some(h => {
        const hStart = timezone.startOfDay(h.startDate);
        const hEnd = h.endDate ? timezone.endOfDay(h.endDate) : hStart;
        return currentDay.isBetween(hStart, hEnd, 'day', '[]');
      });

      for (const employee of employees) {
        const empIdStr = employee._id.toString();
        const key = `${empIdStr}_${dateStr}`;
        const rec = attendanceMap.get(key);
        const leave = leaveMap.get(key);

        // Check if today is weekend for this employee's shift
        const dayOfWeek = currentDay.day(); // 0=Sunday, 1=Monday, ..., 5=Friday, 6=Saturday
        const isWeekend = employee.shiftId?.weekendDays?.includes(dayOfWeek);

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
          shift: employee.shiftId
            ? {
                name: employee.shiftId.name,
                startTime: employee.shiftId.startTime,
                endTime: employee.shiftId.endTime,
                workingHours: employee.shiftId.workingHours || 8,
                gracePeriod: employee.shiftId.gracePeriod || 0,
                overtimeThreshold: employee.shiftId.overtimeThreshold || 0,
                weekendDays: employee.shiftId.weekendDays || [5, 6]
              }
            : null
        };

        // Apply punch data
        if (rec) {
          const checkInFormatted = rec.check_in
            ? timezone.format(rec.check_in, 'HH:mm:ss')
            : null;
          const checkOutFormatted = rec.check_out
            ? timezone.format(rec.check_out, 'HH:mm:ss')
            : null;
          
          // Debug log to understand the timezone conversion
          if (rec.check_in) {
            const checkInUTC = moment(rec.check_in);
            const checkInLocal = timezone.fromUTC(rec.check_in);
            console.log(`🔍 DEBUG check_in - Employee: ${empIdStr}, Date: ${dateStr}`);
            console.log(`   DB Value (UTC): ${rec.check_in}`);
            console.log(`   Formatted: ${checkInFormatted}`);
            console.log(`   From UTC moment: ${checkInLocal.format('YYYY-MM-DD HH:mm:ss ZZ')}`);
          }
          
          record.check_in = checkInFormatted;
          record.check_out = checkOutFormatted;
          record.status = rec.check_out ? 'Present' : 'Incomplete';
        }

        // Set Weekend status first (only if no punch record)
        if (isWeekend && !rec) {
          record.status = 'Weekend';
        }

        // Holiday & Leave override (only if not already Present/Incomplete/Weekend)
        if (isHoliday && ['Absent', 'Weekend'].includes(record.status) && !rec) {
          record.status = 'Holiday';
        }
        if (leave && ['Absent', 'Holiday', 'Weekend'].includes(record.status)) {
          record.status = leave.type === 'remote' ? 'Remote' : 'Leave';
          record.leave_type = leave.type;
        }

        // Calculate Late & Overtime (only for Present/Incomplete days with shift)
        if (rec?.check_in && employee.shiftId && ['Present', 'Incomplete'].includes(record.status)) {
          const shift = employee.shiftId;
          // Use the actual UTC time from database, not the formatted display time
          const checkInMoment = timezone.fromUTC(rec.check_in);
          const [sh, sm] = shift.startTime.split(':').map(Number);
          const scheduledStart = timezone.parse(dateStr).set({ hour: sh, minute: sm, second: 0 });
          const lateThreshold = scheduledStart.clone().add(shift.gracePeriod || 0, 'minutes');

          if (checkInMoment.isAfter(lateThreshold)) {
            record.isLate = true;
            record.lateBy = checkInMoment.diff(lateThreshold, 'minutes');
          }

          if (rec.check_out) {
            // Use the actual UTC time from database, not the formatted display time
            const checkOutMoment = timezone.fromUTC(rec.check_out);
            const workMinutes = checkOutMoment.diff(checkInMoment, 'minutes');
            
            // Format work hours as "9h 04m" format
            const workHours = Math.floor(workMinutes / 60);
            const workMinsRemainder = workMinutes % 60;
            record.work_hours = `${workHours}h ${workMinsRemainder}m`;

            const expectedMinutes = (shift.workingHours || 8) * 60;
            const thresholdMinutes = expectedMinutes + (shift.overtimeThreshold || 0);

            if (workMinutes > thresholdMinutes) {
              record.isOvertime = true;
              // Calculate overtime: total work minutes - expected threshold
              const overtimeMinutes = workMinutes - thresholdMinutes;
              const overtimeHours = Math.floor(overtimeMinutes / 60);
              const overtimeMinsRemainder = overtimeMinutes % 60;
              record.overtimeHours = `${overtimeHours}h ${overtimeMinsRemainder}m`;
            } else {
              record.overtimeHours = '0h 0m';
            }
          }
        }

        finalAttendance.push(record);
      }

      currentDay.add(1, 'day');
    }

    // 8. Calculate Totals
    const totals = {
      totalRecords: finalAttendance.length,
      presentDays: finalAttendance.filter(r => r.status === 'Present').length,
      incompleteDays: finalAttendance.filter(r => r.status === 'Incomplete').length,
      absentDays: finalAttendance.filter(r => r.status === 'Absent').length,
      leaveDays: finalAttendance.filter(r => r.status === 'Leave').length,
      remoteDays: finalAttendance.filter(r => r.status === 'Remote').length,
      holidayDays: finalAttendance.filter(r => r.status === 'Holiday').length,
      weekendDays: finalAttendance.filter(r => r.status === 'Weekend').length,
      totalLateMinutes: finalAttendance.reduce((sum, r) => sum + r.lateBy, 0),
      // Sum total overtime hours: parse "Xh Ym" format and add up
      totalOvertimeHours: (() => {
        let totalMinutes = 0;
        finalAttendance.forEach(r => {
          if (r.overtimeHours && typeof r.overtimeHours === 'string') {
            const match = r.overtimeHours.match(/(\d+)h\s*(\d+)m/);
            if (match) {
              totalMinutes += parseInt(match[1]) * 60 + parseInt(match[2]);
            }
          }
        });
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        return `${hours}h ${mins}m`;
      })()
    };

    return res.status(200).json({
      success: true,
      data: finalAttendance,
      totals
    });

  } catch (error) {
    console.error('Error in getAttendance:', error);
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
};


exports.getEmployeeAttendance = async (req, res) => {
  try {
    let { startDate, endDate, employeeId } = req.query;

    const now = timezone.now();
    const defaultStart = now.clone().startOf('month').toDate();
    const defaultEnd = now.clone().endOf('month').toDate();

    const start = startDate
      ? timezone.parse(startDate).startOf('day').toDate()
      : defaultStart;
    const end = endDate
      ? timezone.parse(endDate).endOf('day').toDate()
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
    let current = timezone.fromUTC(start).startOf('day');
    const endMoment = timezone.fromUTC(end).endOf('day');

    while (current.isSameOrBefore(endMoment, 'day')) {
      dateMap.set(current.format('YYYY-MM-DD'), null);
      current.add(1, 'day');
    }

    const timeToMinutes = (timeStr) => {
      if (!timeStr) return null;
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };

    // Get minutes in app timezone
    const dateToMinutes = (date) => {
      if (!date) return null;
      return timezone.fromUTC(date).hours() * 60 + timezone.fromUTC(date).minutes();
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

    // Manager is optional for Super Admin, required for others
    if (req.user.role !== 'Super Admin' && !employee.managerId) {
      return res.status(400).json({ success: false, error: 'Employee does not have an assigned manager for approval' });
    }

    const targetDate = timezone.parse(attendanceDate).startOf('day').toDate();

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
      proposedCheckIn: proposedCheckIn ? timezone.parse(proposedCheckIn).toDate() : null,
      proposedCheckOut: proposedCheckOut ? timezone.parse(proposedCheckOut).toDate() : null,
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

    // Ensure the reviewer is either the assigned manager or has authorization role
    const reviewer = await Employee.findById(req.user.employeeId);
    const isAssignedManager = request.managerApproverId?.toString() === req.user.employeeId.toString();
    const isAuthorizedRole = ['Manager', 'C-Level Executive', 'HR Manager', 'Company Admin', 'Super Admin'].includes(reviewer?.role);
    
    if (!isAssignedManager && !isAuthorizedRole) {
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
      let workHours = 0;
      if (request.proposedCheckIn && request.proposedCheckOut) {
        const checkInMoment = timezone.fromUTC(request.proposedCheckIn);
        const checkOutMoment = timezone.fromUTC(request.proposedCheckOut);
        const workMinutes = checkOutMoment.diff(checkInMoment, 'minutes');
        workHours = Number((workMinutes / 60).toFixed(2));
      }
      
      const attendance = await EmployeesAttendance.findOneAndUpdate(
        { employeeId: request.employeeId, date: request.attendanceDate },
        { 
          $set: {
            check_in: request.proposedCheckIn,
            check_out: request.proposedCheckOut,
            work_hours: workHours,
            status: (request.proposedCheckIn || request.proposedCheckOut) ? 'Present' : 'Absent',
          }
        },
        { upsert: true, new: true }
      );
      console.log(`✅ Attendance record updated for employee ${request.employeeId} on ${timezone.formatDate(request.attendanceDate)}`);
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