// // const moment = require('moment-timezone');
// // const Employee = require('../models/employee');
// // const EmployeesAttendance = require('../models/employeesAttendance');
// // const LeaveRequest = require('../models/leaveRequest');
// // const HolidayCalendar = require('../models/holidayCalendar');
// // const Log = require('../models/log');

// // async function syncAttendance(companyId, startDate, endDate) {
// //   try {
// //     const start = startDate ? moment.tz(startDate, 'Asia/Dhaka').startOf('day') : moment.tz('2025-09-01', 'Asia/Dhaka').startOf('day');
// //     const end = endDate ? moment.tz(endDate, 'Asia/Dhaka').endOf('day') : moment.tz('2025-09-30', 'Asia/Dhaka').endOf('day');

// //     const employees = await Employee.find({ companyId, deviceUserId: { $ne: null } }).populate('shiftId');
// //     const logs = await Log.find({ companyId, record_time: { $gte: start.toDate(), $lte: end.toDate() } });
    
// //     // Fetch holiday calendars for all years in the date range
// //     const startYear = start.year();
// //     const endYear = end.year();
// //     const years = [];
// //     for (let y = startYear; y <= endYear; y++) {
// //         years.push(y);
// //     }
// //     const holidayCalendars = await HolidayCalendar.find({ companyId, year: { $in: years } }).lean();
// //     const holidays = holidayCalendars.flatMap(cal => cal.holidays);

// //     const leaveRequests = await LeaveRequest.find({ companyId, status: 'approved', startDate: { $lte: end.toDate() }, endDate: { $gte: start.toDate() } });

// //     const userToEmployeeMap = {};
// //     employees.forEach(emp => userToEmployeeMap[emp.deviceUserId] = emp);

// //     const attendanceByEmployee = {};
// //     for (const log of logs) {
// //       if (!log.user_id || !log.record_time) continue;
// //       const logTime = moment.tz(log.record_time, 'Asia/Dhaka');
// //       let windowStart = logTime.hour() < 6 ? logTime.clone().subtract(1, 'day').set({ hour: 6, minute: 0, second: 0, millisecond: 0 }) : 
// //                        logTime.clone().set({ hour: 6, minute: 0, second: 0, millisecond: 0 });
// //       const windowKey = windowStart.format('YYYY-MM-DD');
// //       const employee = userToEmployeeMap[log.user_id];
// //       if (!employee) continue;

// //       if (!attendanceByEmployee[employee._id]) {
// //         attendanceByEmployee[employee._id] = {};
// //       }
// //       if (!attendanceByEmployee[employee._id][windowKey]) {
// //         attendanceByEmployee[employee._id][windowKey] = [];
// //       }
// //       attendanceByEmployee[employee._id][windowKey].push(logTime);
// //     }

// //     const attendanceRecords = [];
// //     const dateIterator = moment(start);
// //     while (dateIterator <= end) {
// //       const windowStart = dateIterator.clone().set({ hour: 6, minute: 0, second: 0 });
// //       const windowKey = windowStart.format('YYYY-MM-DD');
// //       const isWeekend = windowStart.day() === 5 || windowStart.day() === 6;
      
// //       const isHoliday = holidays.some(h => {
// //         const holidayStart = moment(h.startDate).startOf('day');
// //         const holidayEnd = h.endDate ? moment(h.endDate).endOf('day') : holidayStart.clone().endOf('day');
// //         return windowStart.isBetween(holidayStart, holidayEnd, 'day', '[]');
// //       });

// //       for (const employee of employees) {
// //         let status;
// //         let check_in = null;
// //         let check_out = null;
// //         let work_hours = null;
// //         let leave_type = null;
// //         let isLate = false;
// //         let lateBy = 0;
// //         let isEarlyDeparture = false;
// //         let earlyDepartureBy = 0;
// //         let isOvertime = false;
// //         let overtimeHours = 0;
        
// //         if (isWeekend) {
// //           status = 'Weekend';
// //         } else if (isHoliday) {
// //           status = 'Holiday';
// //           leave_type = 'festive';
// //         } else {
// //             status = 'Absent';
// //         }

// //         const leave = leaveRequests.find(lr => lr.employeeId.equals(employee._id) && windowStart.isBetween(lr.startDate, lr.endDate, 'day', '[]'));
// //         if (leave) {
// //           status = leave.type === 'remote' ? 'Remote' : 'Leave';
// //           leave_type = leave.type;
// //         } else if (!isWeekend && !isHoliday && attendanceByEmployee[employee._id] && attendanceByEmployee[employee._id][windowKey]) {
// //           const punches = attendanceByEmployee[employee._id][windowKey].sort((a, b) => a - b);
// //           check_in = punches[0].toDate();
// //           check_out = punches.length > 1 ? punches[punches.length - 1].toDate() : null;
// //           status = check_out ? 'Present' : 'Incomplete';
// //           if (check_out) {
// //             work_hours = moment(check_out).diff(check_in, 'hours', true);

// //             if (employee.shiftId) {
// //               const shift = employee.shiftId;
// //               const [shiftStartHour, shiftStartMinute] = shift.startTime.split(':').map(Number);
// //               const [shiftEndHour, shiftEndMinute] = shift.endTime.split(':').map(Number);

// //               let scheduledShiftStart = moment(windowStart).set({ hour: shiftStartHour, minute: shiftStartMinute, second: 0, millisecond: 0 });
// //               let scheduledShiftEnd = moment(windowStart).set({ hour: shiftEndHour, minute: shiftEndMinute, second: 0, millisecond: 0 });

// //               if (scheduledShiftEnd.isBefore(scheduledShiftStart)) {
// //                 scheduledShiftEnd.add(1, 'day');
// //               }

// //               if (moment(check_in).isAfter(scheduledShiftStart.clone().add(shift.gracePeriod, 'minutes'))) {
// //                 isLate = true;
// //                 lateBy = moment(check_in).diff(scheduledShiftStart, 'minutes');
// //               }

// //               if (moment(check_out).isBefore(scheduledShiftEnd)) {
// //                 isEarlyDeparture = true;
// //                 earlyDepartureBy = scheduledShiftEnd.diff(check_out, 'minutes');
// //               }

// //               if (work_hours > shift.workingHours) {
// //                 isOvertime = true;
// //                 overtimeHours = work_hours - shift.workingHours;
// //                 if (overtimeHours < 0) overtimeHours = 0;
// //               }
// //             }
// //           }
// //         }

// //         attendanceRecords.push({
// //           companyId,
// //           employeeId: employee._id,
// //           date: windowStart.toDate(),
// //           check_in,
// //           check_out,
// //           work_hours,
// //           status,
// //           leave_type,
// //           isLate,
// //           lateBy,
// //           isEarlyDeparture,
// //           earlyDepartureBy,
// //           isOvertime,
// //           overtimeHours
// //         });
// //       }
// //       dateIterator.add(1, 'day');
// //     }

// //     for (const record of attendanceRecords) {
// //       await EmployeesAttendance.updateOne(
// //         { companyId, employeeId: record.employeeId, date: record.date },
// //         { $set: record },
// //         { upsert: true }
// //       );
// //     }

// //     console.log(`Synced ${attendanceRecords.length} attendance records for company ${companyId}`);
// //     return { success: true, recordsSynced: attendanceRecords.length };
// //   } catch (error) {
// //     console.error('Sync error:', error);
// //     return { success: false, error: error.message };
// //   }
// // }

// // module.exports = { syncAttendance };





// const moment = require('moment-timezone');
// const Employee = require('../models/employee');
// const EmployeesAttendance = require('../models/employeesAttendance');
// const LeaveRequest = require('../models/leaveRequest');
// const HolidayCalendar = require('../models/holidayCalendar');
// const Log = require('../models/log');

// async function syncAttendance(companyId, startDate, endDate) {
//   try {
//     // Default: Sept 2025 (or use passed dates) — all in Dhaka time first
//     const startDhaka = startDate
//       ? moment.tz(startDate, 'Asia/Dhaka').startOf('day')
//       : moment.tz('2025-09-01', 'Asia/Dhaka').startOf('day');

//     const endDhaka = endDate
//       ? moment.tz(endDate, 'Asia/Dhaka').endOf('day')
//       : moment.tz('2025-09-30', 'Asia/Dhaka').endOf('day');

//     // Convert to UTC for DB queries
//     const startUTC = startDhaka.clone().utc();
//     const endUTC = endDhaka.clone().utc();

//     const employees = await Employee.find({
//       companyId,
//       deviceUserId: { $ne: null }
//     }).populate({
//       path: 'shiftId',
//       select: 'name startTime endTime workingHours gracePeriod overtimeThreshold'
//     }).lean();

//     if (employees.length === 0) {
//       return { success: true, recordsSynced: 0, message: 'No employees with device' };
//     }

//     // Fetch raw logs in UTC range
//     const logs = await Log.find({
//       companyId,
//       record_time: { $gte: startUTC.toDate(), $lte: endUTC.toDate() }
//     }).lean();

//     // Holidays
//     const years = [];
//     for (let y = startDhaka.year(); y <= endDhaka.year(); y++) years.push(y);

//     const holidayCalendars = await HolidayCalendar.find({
//       companyId,
//       year: { $in: years }
//     }).lean();

//     const holidays = holidayCalendars.flatMap(cal => cal.holidays || []);

//     // Approved leaves
//     const leaveRequests = await LeaveRequest.find({
//       companyId,
//       employeeId: { $in: employees.map(e => e._id) },
//       status: 'approved',
//       startDate: { $lte: endUTC.toDate() },
//       endDate: { $gte: startUTC.toDate() }
//     }).lean();

//     // Map device user → employee
//     const userToEmployee = {};
//     employees.forEach(emp => {
//       if (emp.deviceUserId) userToEmployee[emp.deviceUserId] = emp;
//     });

//     // Group punches by employee + attendance day (6 AM window)
//     const punchesByDay = {};

//     logs.forEach(log => {
//       if (!log.user_id || !log.record_time) return;

//       const recordTime = new Date(log.record_time); // ✅ fixed: cannot redeclare const

//       const punchDhaka = moment.tz(recordTime, 'Asia/Dhaka');
//       const dayStart6AM = punchDhaka.hour() < 6
//         ? punchDhaka.clone().subtract(1, 'day').startOf('day').hour(6)
//         : punchDhaka.clone().startOf('day').hour(6);

//       const dayKey = dayStart6AM.format('YYYY-MM-DD');
//       const employee = userToEmployee[log.user_id];
//       if (!employee) return;

//       const empId = employee._id.toString();

//       if (!punchesByDay[empId]) punchesByDay[empId] = {};
//       if (!punchesByDay[empId][dayKey]) punchesByDay[empId][dayKey] = [];

//       punchesByDay[empId][dayKey].push(punchDhaka);
//     });

//     const attendanceRecords = [];
//     let currentDhaka = startDhaka.clone();

//     while (currentDhaka <= endDhaka) {
//       const dayKey = currentDhaka.format('YYYY-MM-DD'); // e.g., 2025-09-15

//       const windowStartDhaka = currentDhaka.hour() < 6
//         ? currentDhaka.clone().subtract(1, 'day').hour(6).minute(0).second(0)
//         : currentDhaka.clone().hour(6).minute(0).second(0);

//       const windowKey = windowStartDhaka.format('YYYY-MM-DD');

//       const isWeekend = windowStartDhaka.day() === 5 || windowStartDhaka.day() === 6; // Fri-Sat
//       const isHoliday = holidays.some(h => {
//         const hStart = moment.utc(h.startDate).startOf('day');
//         const hEnd = moment.utc(h.endDate || h.startDate).endOf('day');
//         return windowStartDhaka.isSameOrAfter(hStart) && windowStartDhaka.isSameOrBefore(hEnd);
//       });

//       for (const employee of employees) {
//         const empIdStr = employee._id.toString();
//         const punchesToday = (punchesByDay[empIdStr] || {})[windowKey] || [];

//         let status = 'Absent';
//         let check_in = null;
//         let check_out = null;
//         let work_hours = 0;
//         let leave_type = null;
//         let isLate = false;
//         let lateBy = 0;
//         let isEarlyDeparture = false;
//         let earlyDepartureBy = 0;
//         let isOvertime = false;
//         let overtimeHours = 0;

//         // Check leave first
//         const activeLeave = leaveRequests.find(lr =>
//           lr.employeeId.toString() === empIdStr &&
//           windowStartDhaka.isSameOrAfter(moment.utc(lr.startDate).startOf('day')) &&
//           windowStartDhaka.isSameOrBefore(moment.utc(lr.endDate).endOf('day'))
//         );

//         if (activeLeave) {
//           status = activeLeave.type === 'remote' ? 'Remote' : 'Leave';
//           leave_type = activeLeave.type;
//         } else if (isWeekend) {
//           status = 'Weekend';
//         } else if (isHoliday) {
//           status = 'Holiday';
//           leave_type = 'festive';
//         } else if (punchesToday.length > 0) {
//           punchesToday.sort((a, b) => a - b);
//           check_in = punchesToday[0].toDate();
//           check_out = punchesToday[punchesToday.length - 1].toDate();
//           status = check_out ? 'Present' : 'Incomplete';

//           if (check_out && employee.shiftId) {
//             const shift = employee.shiftId;
//             const [sh, sm] = shift.startTime.split(':').map(Number);

//             const shiftStartLocal = moment.tz(windowKey, 'Asia/Dhaka').set({
//               hour: sh,
//               minute: sm,
//               second: 0,
//               millisecond: 0
//             });
//             const shiftStartUTC = shiftStartLocal.clone().utc();

//             const lateThresholdUTC = shiftStartUTC.clone().add(shift.gracePeriod || 0, 'minutes');

//             const checkInUTC = moment.utc(check_in);
//             const checkOutUTC = moment.utc(check_out);

//             if (checkInUTC.isAfter(lateThresholdUTC)) {
//               isLate = true;
//               lateBy = checkInUTC.diff(lateThresholdUTC, 'minutes');
//             }

//             const workedMins = checkOutUTC.diff(checkInUTC, 'minutes');
//             work_hours = Number((workedMins / 60).toFixed(2));

//             const expectedMins = (shift.workingHours || 8) * 60 + (shift.overtimeThreshold || 0);
//             if (workedMins > expectedMins) {
//               isOvertime = true;
//               overtimeHours = Number(((workedMins - expectedMins) / 60).toFixed(2));
//             }
//           }
//         }

//         attendanceRecords.push({
//           companyId,
//           employeeId: employee._id,
//           date: windowStartDhaka.toDate(),
//           check_in,
//           check_out,
//           work_hours,
//           status,
//           leave_type,
//           isLate,
//           lateBy,
//           isEarlyDeparture,
//           earlyDepartureBy,
//           isOvertime,
//           overtimeHours
//         });
//       }

//       currentDhaka.add(1, 'day');
//     }

//     // Upsert all records
//     for (const rec of attendanceRecords) {
//       await EmployeesAttendance.updateOne(
//         { companyId, employeeId: rec.employeeId, date: rec.date },
//         { $set: rec },
//         { upsert: true }
//       );
//     }

//     console.log(`Synced ${attendanceRecords.length} attendance records for company ${companyId}`);
//     return { success: true, recordsSynced: attendanceRecords.length };

//   } catch (error) {
//     console.error('Sync attendance error:', error);
//     return { success: false, error: error.message };
//   }
// }

// module.exports = { syncAttendance };




const moment = require('moment-timezone');
const Employee = require('../models/employee');
const EmployeesAttendance = require('../models/employeesAttendance');
const LeaveRequest = require('../models/leaveRequest');
const HolidayCalendar = require('../models/holidayCalendar');
const Log = require('../models/log');

async function syncAttendance(companyId, startDate, endDate) {
  try {
    const startDhaka = startDate
      ? moment.tz(startDate, 'Asia/Dhaka').startOf('day')
      : moment.tz('2025-09-01', 'Asia/Dhaka').startOf('day');
    const endDhaka = endDate
      ? moment.tz(endDate, 'Asia/Dhaka').endOf('day')
      : moment.tz('2025-09-30', 'Asia/Dhaka').endOf('day');

    const startUTC = startDhaka.clone().utc();
    const endUTC = endDhaka.clone().utc();

    const employees = await Employee.find({
      companyId,
      deviceUserId: { $ne: null }
    }).populate({
      path: 'shiftId',
      select: 'name startTime endTime workingHours gracePeriod overtimeThreshold'
    }).lean();

    if (employees.length === 0) {
      return { success: true, recordsSynced: 0 };
    }

    const logs = await Log.find({
      companyId,
      record_time: { $gte: startUTC.toDate(), $lte: endUTC.toDate() }
    }).lean();

    const years = [];
    for (let y = startDhaka.year(); y <= endDhaka.year(); y++) years.push(y);

    const holidayCalendars = await HolidayCalendar.find({ companyId, year: { $in: years } }).lean();
    const holidays = holidayCalendars.flatMap(cal => cal.holidays || []);

    const leaveRequests = await LeaveRequest.find({
      companyId,
      status: 'approved',
      startDate: { $lte: endUTC.toDate() },
      endDate: { $gte: startUTC.toDate() }
    }).lean();

    const userToEmployee = {};
    employees.forEach(emp => {
      if (emp.deviceUserId) userToEmployee[emp.deviceUserId] = emp;
    });

    const punchesByDay = {};

    logs.forEach(log => {
      if (!log.user_id || !log.record_time) return;
      const punchDhaka = moment.tz(log.record_time, 'Asia/Dhaka');
      const dayStart6AM = punchDhaka.hour() < 6
        ? punchDhaka.clone().subtract(1, 'day').startOf('day').add(6, 'hours')
        : punchDhaka.clone().startOf('day').add(6, 'hours');
      const dayKey = dayStart6AM.format('YYYY-MM-DD');
      const emp = userToEmployee[log.user_id];
      if (!emp) return;

      const empId = emp._id.toString();
      if (!punchesByDay[empId]) punchesByDay[empId] = {};
      if (!punchesByDay[empId][dayKey]) punchesByDay[empId][dayKey] = [];
      punchesByDay[empId][dayKey].push(punchDhaka);
    });

    const attendanceRecords = [];
    let currentDhaka = startDhaka.clone();

    while (currentDhaka <= endDhaka) {
      const windowStartDhaka = currentDhaka.hour() < 6
        ? currentDhaka.clone().subtract(1, 'day').startOf('day').add(6, 'hours')
        : currentDhaka.clone().startOf('day').add(6, 'hours');
      const windowKey = windowStartDhaka.format('YYYY-MM-DD');

      const isHoliday = holidays.some(h => {
        const hStart = moment.utc(h.startDate).startOf('day');
        const hEnd = moment.utc(h.endDate || h.startDate).endOf('day');
        return windowStartDhaka.isSameOrAfter(hStart) && windowStartDhaka.isSameOrBefore(hEnd);
      });

      for (const emp of employees) {
        const empIdStr = emp._id.toString();
        const punches = (punchesByDay[empIdStr] || {})[windowKey] || [];

        let status = 'Absent';
        let check_in = null;
        let check_out = null;
        let work_hours = 0;
        let leave_type = null;
        let isLate = false;
        let lateBy = 0;
        let isOvertime = false;
        let overtimeHours = 0;

        const activeLeave = leaveRequests.find(lr =>
          lr.employeeId.toString() === empIdStr &&
          windowStartDhaka.isSameOrAfter(moment.utc(lr.startDate).startOf('day')) &&
          windowStartDhaka.isSameOrBefore(moment.utc(lr.endDate).endOf('day'))
        );

        if (activeLeave) {
          status = activeLeave.type === 'remote' ? 'Remote' : 'Leave';
          leave_type = activeLeave.type;
        } else if (isHoliday) {
          status = 'Holiday';
          leave_type = 'festive';
        } else if (punches.length > 0) {
          punches.sort((a, b) => a - b);
          check_in = punches[0].toDate();
          check_out = punches[punches.length - 1].toDate();
          status = check_out ? 'Present' : 'Incomplete';

          if (check_out && emp.shiftId) {
            const shift = emp.shiftId;

            const shiftStart = moment.tz(`${windowKey} ${shift.startTime}`, 'YYYY-MM-DD HH:mm', 'Asia/Dhaka');
            const lateThreshold = shiftStart.clone().add(shift.gracePeriod || 0, 'minutes');
            const checkIn = moment.tz(check_in, 'Asia/Dhaka');

            if (checkIn.isAfter(lateThreshold)) {
              isLate = true;
              lateBy = checkIn.diff(lateThreshold, 'minutes');
            }

            const checkOut = moment.tz(check_out, 'Asia/Dhaka');
            const workedMins = checkOut.diff(checkIn, 'minutes');
            work_hours = Number((workedMins / 60).toFixed(2));

            const expectedMins = (shift.workingHours || 8) * 60 + (shift.overtimeThreshold || 0);
            if (workedMins > expectedMins) {
              isOvertime = true;
              overtimeHours = Number(((workedMins - expectedMins) / 60).toFixed(2));
            }
          }
        }

        attendanceRecords.push({
          companyId,
          employeeId: emp._id,
          date: windowStartDhaka.toDate(),
          check_in,
          check_out,
          work_hours,
          status,
          leave_type,
          isLate,
          lateBy,
          isOvertime,
          overtimeHours
        });
      }
      currentDhaka.add(1, 'day');
    }

    for (const rec of attendanceRecords) {
      await EmployeesAttendance.updateOne(
        { companyId, employeeId: rec.employeeId, date: rec.date },
        { $set: rec },
        { upsert: true }
      );
    }

    console.log(`Synced ${attendanceRecords.length} records for company ${companyId}`);
    return { success: true, recordsSynced: attendanceRecords.length };

  } catch (error) {
    console.error('Sync error:', error);
    return { success: false, error: error.message };
  }
}

module.exports = { syncAttendance };