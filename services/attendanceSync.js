const moment = require('moment-timezone');
const Employee = require('../models/employee');
const EmployeesAttendance = require('../models/EmployeesAttendance');
const LeaveRequest = require('../models/leaveRequest');
const HolidayCalendar = require('../models/holidayCalendar');
const Log = require('../models/log');

async function syncAttendance(companyId, startDate, endDate) {
  try {
    const start = startDate ? moment.tz(startDate, 'Asia/Dhaka').startOf('day') : moment.tz('2025-09-01', 'Asia/Dhaka').startOf('day');
    const end = endDate ? moment.tz(endDate, 'Asia/Dhaka').endOf('day') : moment.tz('2025-09-30', 'Asia/Dhaka').endOf('day');

    const employees = await Employee.find({ companyId, deviceUserId: { $ne: null } }).populate('shiftId');
    const logs = await Log.find({ companyId, record_time: { $gte: start.toDate(), $lte: end.toDate() } });
    
    // Fetch holiday calendar for the year of the start date
    const year = start.year();
    const holidayCalendar = await HolidayCalendar.findOne({ companyId, year });
    const holidays = holidayCalendar ? holidayCalendar.holidays : [];

    const leaveRequests = await LeaveRequest.find({ companyId, status: 'approved', startDate: { $lte: end.toDate() }, endDate: { $gte: start.toDate() } });

    const userToEmployeeMap = {};
    employees.forEach(emp => userToEmployeeMap[emp.deviceUserId] = emp);

    const attendanceByEmployee = {};
    for (const log of logs) {
      if (!log.user_id || !log.record_time) continue;
      const logTime = moment.tz(log.record_time, 'Asia/Dhaka');
      let windowStart = logTime.hour() < 6 ? logTime.clone().subtract(1, 'day').set({ hour: 6, minute: 0, second: 0, millisecond: 0 }) : 
                       logTime.clone().set({ hour: 6, minute: 0, second: 0, millisecond: 0 });
      const windowKey = windowStart.format('YYYY-MM-DD');
      const employee = userToEmployeeMap[log.user_id];
      if (!employee) continue;

      if (!attendanceByEmployee[employee._id]) {
        attendanceByEmployee[employee._id] = {};
      }
      if (!attendanceByEmployee[employee._id][windowKey]) {
        attendanceByEmployee[employee._id][windowKey] = [];
      }
      attendanceByEmployee[employee._id][windowKey].push(logTime);
    }

    const attendanceRecords = [];
    const dateIterator = moment(start);
    while (dateIterator <= end) {
      const windowStart = dateIterator.clone().set({ hour: 6, minute: 0, second: 0 });
      const windowKey = windowStart.format('YYYY-MM-DD');
      const isWeekend = windowStart.day() === 5 || windowStart.day() === 6;
      const isHoliday = holidays.some(h => moment(h.date).isSame(windowStart, 'day'));

      for (const employee of employees) {
        let status;
        let check_in = null;
        let check_out = null;
        let work_hours = null;
        let leave_type = null;
        let isLate = false;
        let lateBy = 0;
        let isEarlyDeparture = false;
        let earlyDepartureBy = 0;
        let isOvertime = false;
        let overtimeHours = 0;
        
        if (isWeekend) {
          status = 'Weekend';
        } else if (isHoliday) {
          status = 'Holiday';
          leave_type = 'festive';
        } else {
            status = 'Absent';
        }

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

            if (employee.shiftId) {
              const shift = employee.shiftId;
              const [shiftStartHour, shiftStartMinute] = shift.startTime.split(':').map(Number);
              const [shiftEndHour, shiftEndMinute] = shift.endTime.split(':').map(Number);

              let scheduledShiftStart = moment(windowStart).set({ hour: shiftStartHour, minute: shiftStartMinute, second: 0, millisecond: 0 });
              let scheduledShiftEnd = moment(windowStart).set({ hour: shiftEndHour, minute: shiftEndMinute, second: 0, millisecond: 0 });

              if (scheduledShiftEnd.isBefore(scheduledShiftStart)) {
                scheduledShiftEnd.add(1, 'day');
              }

              if (moment(check_in).isAfter(scheduledShiftStart.clone().add(shift.gracePeriod, 'minutes'))) {
                isLate = true;
                lateBy = moment(check_in).diff(scheduledShiftStart, 'minutes');
              }

              if (moment(check_out).isBefore(scheduledShiftEnd)) {
                isEarlyDeparture = true;
                earlyDepartureBy = scheduledShiftEnd.diff(check_out, 'minutes');
              }

              if (work_hours > shift.workingHours) {
                isOvertime = true;
                overtimeHours = work_hours - shift.workingHours;
                if (overtimeHours < 0) overtimeHours = 0;
              }
            }
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
          leave_type,
          isLate,
          lateBy,
          isEarlyDeparture,
          earlyDepartureBy,
          isOvertime,
          overtimeHours
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