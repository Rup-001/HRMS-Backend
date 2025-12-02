const EmployeesAttendance = require('../models/employeesAttendance');
const AttendanceAdjustmentRequest = require('../models/attendanceAdjustmentRequest');
const timezone = require('../utils/timezoneHelper');
const moment = require('moment-timezone');
const Employee = require('../models/employee');
const HolidayCalendar = require('../models/holidayCalendar'); // Import HolidayCalendar model
const LeaveRequest = require('../models/leaveRequest'); // Import LeaveRequest model


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