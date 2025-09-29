const moment = require('moment-timezone');
const Employee = require('../models/employee');
const EmployeesAttendance = require('../models/EmployeesAttendance');
const LeaveRequest = require('../models/leaveRequest');
const Holiday = require('../models/holiday');
const Log = require('../models/log');

async function syncAttendance(companyId, startDate, endDate) {
  try {
    const start = startDate ? moment.tz(startDate, 'Asia/Dhaka').startOf('day') : moment.tz('2025-09-01', 'Asia/Dhaka').startOf('day');
    const end = endDate ? moment.tz(endDate, 'Asia/Dhaka').endOf('day') : moment.tz('2025-09-30', 'Asia/Dhaka').endOf('day');

    const employees = await Employee.find({ companyId, deviceUserId: { $ne: null } });
    const logs = await Log.find({ companyId, record_time: { $gte: start.toDate(), $lte: end.toDate() } });
    const holidays = await Holiday.find({ $or: [{ companyId }, { isNational: true }], date: { $gte: start.toDate(), $lte: end.toDate() } });
    const leaveRequests = await LeaveRequest.find({ companyId, status: 'approved', startDate: { $lte: end.toDate() }, endDate: { $gte: start.toDate() } });

    const userToEmployeeMap = {};
    employees.forEach(emp => userToEmployeeMap[emp.deviceUserId] = emp._id);

    const attendanceByEmployee = {};
    for (const log of logs) {
      if (!log.user_id || !log.record_time) continue;
      const logTime = moment.tz(log.record_time, 'Asia/Dhaka');
      let windowStart = logTime.hour() < 6 ? logTime.clone().subtract(1, 'day').set({ hour: 6, minute: 0, second: 0, millisecond: 0 }) : 
                       logTime.clone().set({ hour: 6, minute: 0, second: 0, millisecond: 0 });
      const windowKey = windowStart.format('YYYY-MM-DD');
      const employeeId = userToEmployeeMap[log.user_id];
      if (!employeeId) continue;

      if (!attendanceByEmployee[employeeId]) {
        attendanceByEmployee[employeeId] = {};
      }
      if (!attendanceByEmployee[employeeId][windowKey]) {
        attendanceByEmployee[employeeId][windowKey] = [];
      }
      attendanceByEmployee[employeeId][windowKey].push(logTime);
    }

    const attendanceRecords = [];
    const dateIterator = moment(start);
    while (dateIterator <= end) {
      const windowStart = dateIterator.clone().set({ hour: 6, minute: 0, second: 0 });
      const windowKey = windowStart.format('YYYY-MM-DD');
      const isWeekend = windowStart.day() === 5 || windowStart.day() === 6;
      const isHoliday = holidays.some(h => moment(h.date).isSame(windowStart, 'day'));

      for (const employee of employees) {
        let status = isWeekend ? 'Weekend' : isHoliday ? 'Holiday' : 'Absent';
        let check_in = null;
        let check_out = null;
        let work_hours = null;
        let leave_type = null;

        const leave = leaveRequests.find(lr => lr.employeeId.equals(employee._id) && windowStart.isBetween(lr.startDate, lr.endDate, 'day', '[]'));
        if (leave) {
          status = leave.type === 'remote' ? 'Remote' : 'Leave';
          leave_type = leave.type;
        } else if (!isWeekend && !isHoliday && attendanceByEmployee[employee._id] && attendanceByEmployee[employee._id][windowKey]) {
          const punches = attendanceByEmployee[employee._id][windowKey].sort((a, b) => a - b);
          check_in = punches[0].toDate();
          check_out = punches.length > 1 ? punches[punches.length - 1].toDate() : null;
          status = check_out ? 'Present' : 'Incomplete';
          if (check_out) {
            work_hours = moment(check_out).diff(check_in, 'hours', true);
          }
        }

        attendanceRecords.push({
          companyId,
          employeeId: employee._id,
          date: windowStart.toDate(),
          check_in,
          check_out,
          work_hours,
          status,
          leave_type
        });
      }
      dateIterator.add(1, 'day');
    }

    for (const record of attendanceRecords) {
      await EmployeesAttendance.updateOne(
        { companyId, employeeId: record.employeeId, date: record.date },
        { $set: record },
        { upsert: true }
      );
    }

    console.log(`Synced ${attendanceRecords.length} attendance records for company ${companyId}`);
    return { success: true, recordsSynced: attendanceRecords.length };
  } catch (error) {
    console.error('Sync error:', error);
    return { success: false, error: error.message };
  }
}

module.exports = { syncAttendance };