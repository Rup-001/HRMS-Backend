const timezone = require('../utils/timezoneHelper');
const Employee = require('../models/employee');
const EmployeesAttendance = require('../models/employeesAttendance');
const LeaveRequest = require('../models/leaveRequest');
const HolidayCalendar = require('../models/holidayCalendar');
const Log = require('../models/log');

async function syncAttendance(companyId, startDate, endDate) {
  try {
    const start = startDate ? timezone.parse(startDate).startOf('day') : timezone.parse('2025-09-01').startOf('day');
    const end = endDate ? timezone.parse(endDate).endOf('day') : timezone.parse('2025-09-30').endOf('day');

    const employees = await Employee.find({ companyId, deviceUserId: { $ne: null } }).populate('shiftId');
    const logs = await Log.find({ companyId, timestamp: { $gte: start.toDate(), $lte: end.toDate() } });
    
    // Fetch holiday calendars for all years in the date range
    const startYear = start.year();
    const endYear = end.year();
    const years = [];
    for (let y = startYear; y <= endYear; y++) {
        years.push(y);
    }
    const holidayCalendars = await HolidayCalendar.find({ companyId, year: { $in: years } }).lean();
    const holidays = holidayCalendars.flatMap(cal => cal.holidays);

    const leaveRequests = await LeaveRequest.find({ companyId, status: 'approved', startDate: { $lte: end.toDate() }, endDate: { $gte: start.toDate() } });

    const userToEmployeeMap = {};
    employees.forEach(emp => userToEmployeeMap[emp.deviceUserId] = emp);

    const attendanceByEmployee = {};
    for (const log of logs) {
      if (!log.user_id || !log.timestamp) continue;
      const logTime = timezone.fromUTC(log.timestamp);
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
    let dateIterator = start.clone();
    while (dateIterator.isSameOrBefore(end, 'day')) {
      const windowStart = dateIterator.clone().set({ hour: 6, minute: 0, second: 0 });
      const windowKey = windowStart.format('YYYY-MM-DD');
      const isWeekend = windowStart.day() === 5 || windowStart.day() === 6;
      
      const isHoliday = holidays.some(h => {
        const holidayStart = timezone.startOfDay(h.startDate);
        const holidayEnd = h.endDate ? timezone.endOfDay(h.endDate) : holidayStart.clone().endOf('day');
        return windowStart.isBetween(holidayStart, holidayEnd, 'day', '[]');
      });

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
          check_in = timezone.toUTC(punches[0]);
          check_out = punches.length > 1 ? timezone.toUTC(punches[punches.length - 1]) : null;
          status = check_out ? 'Present' : 'Incomplete';
          if (check_out) {
            work_hours = punches[punches.length - 1].diff(punches[0], 'hours', true);

            if (employee.shiftId) {
              const shift = employee.shiftId;
              const [shiftStartHour, shiftStartMinute] = shift.startTime.split(':').map(Number);
              const [shiftEndHour, shiftEndMinute] = shift.endTime.split(':').map(Number);

              let scheduledShiftStart = windowStart.clone().set({ hour: shiftStartHour, minute: shiftStartMinute, second: 0, millisecond: 0 });
              let scheduledShiftEnd = windowStart.clone().set({ hour: shiftEndHour, minute: shiftEndMinute, second: 0, millisecond: 0 });

              if (scheduledShiftEnd.isBefore(scheduledShiftStart)) {
                scheduledShiftEnd.add(1, 'day');
              }

              if (punches[0].isAfter(scheduledShiftStart.clone().add(shift.gracePeriod, 'minutes'))) {
                isLate = true;
                lateBy = punches[0].diff(scheduledShiftStart, 'minutes');
              }

              if (punches[punches.length - 1].isBefore(scheduledShiftEnd)) {
                isEarlyDeparture = true;
                earlyDepartureBy = scheduledShiftEnd.diff(punches[punches.length - 1], 'minutes');
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
          date: timezone.toUTC(windowStart),
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