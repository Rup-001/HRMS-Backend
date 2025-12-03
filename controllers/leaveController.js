
const LeaveRequest = require('../models/leaveRequest');
const LeaveEntitlement = require('../models/leaveEntitlement');
const LeavePolicy = require('../models/leavePolicy');
const EmployeesAttendance = require('../models/employeesAttendance');
const Employee = require('../models/employee');
const moment = require('moment-timezone');

exports.createLeaveRequest = async (req, res) => {
  try {
    const { startDate, endDate, type, isHalfDay, remarks } = req.body;
    if (!startDate || !endDate || !type) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const employee = await Employee.findById(req.user.employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }

    // Parse dates as YYYY-MM-DD in UTC
    const start = moment.utc(startDate, 'YYYY-MM-DD', true).startOf('day').toDate();
    const end = moment.utc(endDate, 'YYYY-MM-DD', true).startOf('day').toDate();

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid date format. Use YYYY-MM-DD' });
    }
    if (start > end) {
      return res.status(400).json({ success: false, error: 'startDate must be before or equal to endDate' });
    }
    if (type === 'annual') {
  const currentYear = moment(start).year();
  const entitlement = await LeaveEntitlement.findOne({ employeeId: req.user.employeeId, year: currentYear });
  const casualBalance = (entitlement?.casual || 0) - taken.casual;

  if (casualBalance > 0) {
    return res.status(400).json({
      success: false,
      error: 'You must exhaust your Casual Leave balance before applying for Annual Leave.'
    });
  }
}

    // Check for existing leave requests in the date range
    const existingLeave = await LeaveRequest.findOne({
      employeeId: req.user.employeeId,
      $or: [
        { startDate: { $lte: end }, endDate: { $gte: start } }
      ]
    });
    if (existingLeave) {
      return res.status(400).json({ success: false, error: 'Leave request already exists for the specified date range' });
    }

    // Check for weekend or holiday in EmployeesAttendance
    let currentDate = new Date(start);
    const endDateLoop = new Date(end); // Renamed to avoid conflict
    while (currentDate <= endDateLoop) {
      const normalizedDate = moment.utc(currentDate).startOf('day').toDate();
      const attendance = await EmployeesAttendance.findOne({
        employeeId: req.user.employeeId,
        date: normalizedDate,
        status: { $in: ['Weekend', 'Holiday'] }
      });
      if (attendance) {
        return res.status(400).json({ 
          success: false, 
          error: `Cannot request leave on ${normalizedDate.toISOString().split('T')[0]}: marked as ${attendance.status}` 
        });
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Calculate leave duration
    const leaveDuration = moment(end).diff(moment(start), 'days') + 1;
    const isHalfDayBool = req.body.isHalfDay === 'on' || req.body.isHalfDay === true;
    const currentRequestDuration = isHalfDayBool ? 0.5 : leaveDuration;


    // Check leave entitlement
    if (type !== 'remote') { // Remote work does not deduct from leave balance
      const year = moment(start).year();
      const entitlement = await LeaveEntitlement.findOne({ employeeId: req.user.employeeId, year });

      if (!entitlement) {
        return res.status(400).json({ success: false, error: 'Leave entitlement not found for current year.' });
      }

      console.log(`[Leave Balance Check] Employee: ${req.user.employeeId}, Leave Type: ${type}, Year: ${year}`);
      console.log(`[Leave Balance Check] Entitlement for ${type}: ${entitlement[type]}`);

      // Calculate leave taken for the current year, including pending and approved
      const approvedAndPendingLeaves = await LeaveRequest.find({
        employeeId: req.user.employeeId,
        status: { $in: ['approved', 'pending'] },
        type: type,
        $expr: { $eq: [{ $year: "$startDate" }, year] }
      });

      console.log(`[Leave Balance Check] Found ${approvedAndPendingLeaves.length} approved/pending leaves.`);

      let leaveTaken = 0;
      for (const leave of approvedAndPendingLeaves) {
        const duration = leave.isHalfDay ? 0.5 : (moment(leave.endDate).diff(moment(leave.startDate), 'days') + 1);
        leaveTaken += duration;
        console.log(`[Leave Balance Check] - Pending/Approved Leave: ${leave._id}, Duration: ${duration}`);
      }

      console.log(`[Leave Balance Check] Total Leave Taken (Approved + Pending): ${leaveTaken}`);
      
      const availableLeave = entitlement[type] - leaveTaken;
      
      console.log(`[Leave Balance Check] Available Leave: ${availableLeave} (Entitlement: ${entitlement[type]} - Taken: ${leaveTaken})`);
      console.log(`[Leave Balance Check] Current Request Duration: ${currentRequestDuration}`);

      if (availableLeave < currentRequestDuration) {
        console.log(`[Leave Balance Check] INSUFFICIENT LEAVE. Available: ${availableLeave}, Requested: ${currentRequestDuration}`);
        return res.status(400).json({ success: false, error: `Insufficient ${type} leave. Available: ${availableLeave} days.` });
      }

      // Sick leave limit logic
      if (type === 'sick') {
        const leavePolicy = await LeavePolicy.findOne({ companyId: req.user.companyId });
        const sickLeaveLimit = leavePolicy?.sickLeaveLimit || 14; // Default to 14 days if not specified

        const totalSickLeaveTaken = leaveTaken + currentRequestDuration;

        if (totalSickLeaveTaken > sickLeaveLimit) {
          return res.status(400).json({ 
            success: false, 
            error: `Sick leave exceeds the annual limit of ${sickLeaveLimit} days. Excess will be treated as LWP or adjusted.` 
          });
        }
      }
    }

    const leaveRequest = new LeaveRequest({
      companyId: req.user.companyId,
      employeeId: req.user.employeeId,
      startDate: start,
      endDate: end,
      type,
      isHalfDay: isHalfDayBool,
      remarks, // Include remarks field
      approverId: employee.managerId // Automatically set to employee's manager
    });
    await leaveRequest.save();
    console.log(`✅ Created leave request: employeeId: ${req.user.employeeId}, startDate: ${start.toISOString()}, endDate: ${end.toISOString()}`);
    res.status(201).json({ success: true, data: leaveRequest });
  } catch (error) {
    console.error(`❌ Error creating leave request: ${error.message}`);
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.approveLeaveRequest = async (req, res) => {
  try {
    const leaveRequest = await LeaveRequest.findById(req.params.id);
    if (!leaveRequest) {
      return res.status(404).json({ success: false, error: 'Leave request not found' });
    }
    if (req.user.role === 'Manager' && req.user.companyId.toString() !== leaveRequest.companyId.toString()) {
      return res.status(403).json({ success: false, error: 'Company access denied' });
    }
    // Manager's approval is the final step. No further HR approval is required.
    leaveRequest.status = 'approved';
    leaveRequest.approverId = req.user.employeeId;
    await leaveRequest.save();

    // Deduct leave from entitlement
    const leaveDuration = moment(leaveRequest.endDate).diff(moment(leaveRequest.startDate), 'days') + 1;
    const leaveType = leaveRequest.type;
    const year = moment(leaveRequest.startDate).year();

    if (leaveType !== 'remote') { // Do not deduct for remote work
      // The entitlement is now considered the initial allocation.
      // The actual balance will be calculated dynamically by getLeaveSummary.
      // No direct deduction from entitlement here.
    }

    // Update EmployeesAttendance for each date in the range
    const status = leaveRequest.type === 'remote' ? 'Remote' : 'Leave';
    const leave_type = leaveRequest.type === 'remote' ? null : leaveRequest.type;

    let currentDate = new Date(leaveRequest.startDate);
    const endDateLoop = new Date(leaveRequest.endDate); // Renamed to avoid conflict
    while (currentDate <= endDateLoop) {
      const normalizedDate = moment.utc(currentDate).startOf('day').toDate();
      // Check existing attendance to avoid overwriting Present/Incomplete
      const existingAttendance = await EmployeesAttendance.findOne({
        employeeId: leaveRequest.employeeId,
        date: normalizedDate
      });
      if (existingAttendance && ['Present', 'Incomplete'].includes(existingAttendance.status)) {
        console.warn(`⚠️ Skipping attendance update for employeeId: ${leaveRequest.employeeId}, date: ${normalizedDate.toISOString().split('T')[0]}, existing status: ${existingAttendance.status}`);
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }
      const attendance = await EmployeesAttendance.findOneAndUpdate(
        { employeeId: leaveRequest.employeeId, date: normalizedDate },
        { 
          $set: { 
            status, 
            leave_type,
            companyId: leaveRequest.companyId,
            employeeId: leaveRequest.employeeId,
            date: normalizedDate,
            check_in: null,
            check_out: null,
            work_hours: 0
          }
        },
        { upsert: true, new: true }
      );
      console.log(`✅ Updated attendance for employeeId: ${leaveRequest.employeeId}, date: ${normalizedDate.toISOString().split('T')[0]}, status: ${status}, leave_type: ${leave_type}`);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    res.status(200).json({ success: true, data: leaveRequest });
  } catch (error) {
    console.error(`❌ Error approving leave request: ${error.message}`);
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.denyLeaveRequest = async (req, res) => {
  try {
    const leaveRequest = await LeaveRequest.findById(req.params.id);
    if (!leaveRequest) {
      return res.status(404).json({ success: false, error: 'Leave request not found' });
    }
    if (req.user.role === 'Manager' && req.user.companyId.toString() !== leaveRequest.companyId.toString()) {
      return res.status(403).json({ success: false, error: 'Company access denied' });
    }
    leaveRequest.status = 'denied';
    leaveRequest.approverId = req.user.employeeId;
    await leaveRequest.save();
    console.log(`✅ Denied leave request: id: ${req.params.id}, employeeId: ${leaveRequest.employeeId}`);
    res.status(200).json({ success: true, data: leaveRequest });
  } catch (error) {
    console.error(`❌ Error denying leave request: ${error.message}`);
    res.status(400).json({ success: false, error: error.message });
  }
};


exports.getLeaveRequests = async (req, res) => {
  try {
    let query;

    if (req.user.role === 'Employee') {
      // 🧍 Employee → only their own leave requests
      // query = { employeeId: req.user.employeeId, companyId: req.user.companyId };
      query = { employeeId: req.user.employeeId };
    } else if (req.user.role === 'Manager') {
      // 👨‍💼 Manager → Find employees who report to this manager
      // const employees = await Employee.find({ managerId: req.user.employeeId, companyId: req.user.companyId });
      const employees = await Employee.find({ managerId: req.user.employeeId });

      const employeeIds = employees.map(emp => emp._id);

      // query = { employeeId: { $in: employeeIds }, companyId: req.user.companyId };
      query = { employeeId: { $in: employeeIds } };
    } else if (req.user.role === 'Super Admin' || req.user.role === 'HR Manager') {
      // 🧑‍💻 Super Admin & HR Manager → all requests within their company
      // query = { companyId: req.user.companyId };
      query = {}; 
    } else if (req.user.role === 'C-Level Executive') {
      // 🏢 C Level Executive → all requests across all companies
      query = {}; 
    } else {
      // 🛡️ Default: restrict to same company (removed)
      // query = { companyId: req.user.companyId };
      query = {};
    }

    const leaveRequests = await LeaveRequest.find(query)
      .populate('employeeId', 'fullName newEmployeeCode')
      .populate('approverId', 'fullName');

    console.log(`✅ Retrieved ${leaveRequests.length} leave requests for user: ${req.user.employeeId}, role: ${req.user.role}`);
    res.status(200).json({ success: true, data: leaveRequests });
  } catch (error) {
    console.error(`❌ Error retrieving leave requests: ${error.message}`);
    res.status(400).json({ success: false, error: error.message });
  }
};


// ===== FINAL FIXED getLeaveSummary (copy-paste this) =====
exports.getLeaveSummary = async (req, res) => {
  try {
    const { year, employeeId: queryId } = req.query;
    const userId = ['Super Admin', 'HR Manager'].includes(req.user.role) && queryId 
      ? queryId 
      : req.user.employeeId;

    const targetYear = parseInt(year) || moment().year();

    const employee = await Employee.findById(userId).lean();
    if (!employee) return res.status(404).json({ success: false, error: 'Employee not found' });

    // Always ensure entitlement exists — create if missing
    let entitlement = await LeaveEntitlement.findOne({ employeeId: userId, year: targetYear });
    if (!entitlement) {
      await exports.createLeaveEntitlement(userId, employee.joiningDate, targetYear);
      entitlement = await LeaveEntitlement.findOne({ employeeId: userId, year: targetYear });
    }

    // Double safety — if still null, return zeros
    if (!entitlement) {
      entitlement = {
        casual: 0,
        sick: 0,
        annual: 0,
        maternity: 0,
        festive: 0
      };
    }

    // Calculate taken leaves
    const leaves = await LeaveRequest.find({
      employeeId: userId,
      status: { $in: ['approved', 'pending'] },
      startDate: { $gte: new Date(`${targetYear}-01-01`) },
      endDate: { $lte: new Date(`${targetYear}-12-31`) }
    });

    const taken = { casual: 0, sick: 0, annual: 0, maternity: 0, festive: 0 };
    for (const l of leaves) {
      if (l.type === 'remote') continue;
      const days = l.isHalfDay ? 0.5 : moment(l.endDate).diff(moment(l.startDate), 'days') + 1;
      if (taken.hasOwnProperty(l.type)) taken[l.type] += days;
    }

    // Maternity: show "N/A" for males
    const maternityBalance = employee.gender === 'Female' 
      ? entitlement.maternity - taken.maternity 
      : 'N/A';

    const maternityEntitled = employee.gender === 'Female' 
      ? entitlement.maternity 
      : 'N/A';

    res.json({
      success: true,
      data: {
        year: targetYear,
        employeeName: employee.fullName,
        gender: employee.gender,
        entitlement: {
          casual: entitlement.casual || 0,
          sick: entitlement.sick || 0,
          annual: entitlement.annual || 0,
          maternity: maternityEntitled,
          festive: entitlement.festive || 0
        },
        taken: {
          casual: taken.casual,
          sick: taken.sick,
          annual: taken.annual,
          maternity: taken.maternity,
          festive: taken.festive
        },
        balance: {
          casual: (entitlement.casual || 0) - taken.casual,
          sick: (entitlement.sick || 0) - taken.sick,
          annual: (entitlement.annual || 0) - taken.annual,
          maternity: maternityBalance,
          festive: (entitlement.festive || 0) - taken.festive
        }
      }
    });
  } catch (error) {
    console.error('getLeaveSummary error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch leave summary',
      data: {
        year: moment().year(),
        entitlement: { casual: 0, sick: 0, annual: 0, maternity: 'N/A', festive: 0 },
        taken: { casual: 0, sick: 0, annual: 0, maternity: 0, festive: 0 },
        balance: { casual: 0, sick: 0, annual: 0, maternity: 'N/A', festive: 0 }
      }
    });
  }
};


// // ================= CREATE LEAVE ENTITLEMENT (MAIN LOGIC) =================

// exports.createLeaveEntitlement = async (employeeId, joiningDate, specificYear = null) => {
//   try {
//     const employee = await Employee.findById(employeeId).lean();
//     if (!employee) throw new Error('Employee not found');

//     const companyId = employee.companyId;
//     const gender = employee.gender;
//     const joining = moment(joiningDate);
//     const now = moment();
//     const targetYear = specificYear || now.year();

//     // Determine last working day (if separated)
//     const lastWorkingDay = employee.lastWorkingDay ? moment(employee.lastWorkingDay) : null;
//     const isSeparated = lastWorkingDay && lastWorkingDay.isBefore(now, 'day');

//     // Use separation date as end of service if exists
//     const serviceEndDate = isSeparated ? lastWorkingDay : now;

//     // Get policy for the target year
//     let leavePolicy = await LeavePolicy.findOne({ companyId, year: targetYear });
//     if (!leavePolicy) {
//       leavePolicy = await new LeavePolicy({ companyId, year: targetYear });
//       await leavePolicy.save();
//     }

//     const yearStart = moment(`${targetYear}-01-01`);
//     const yearEnd = yearStart.clone().endOf('year');

//     // Effective period in this year
//     const periodStart = joining.isAfter(yearStart) ? joining.clone() : yearStart.clone();
//     let periodEnd = yearEnd.clone();

//     // If employee left during this year, cap at lastWorkingDay
//     if (isSeparated && lastWorkingDay.isBetween(yearStart, yearEnd, null, '[]')) {
//       periodEnd = lastWorkingDay.clone();
//     }

//     const totalDaysInPeriod = periodEnd.diff(periodStart, 'days') + 1;
//     const totalDaysInYear = 365 + (yearEnd.isLeapYear() ? 1 : 0); // Accurate days

//     if (totalDaysInPeriod <= 0) {
//       // No entitlement if not in service during this year
//       return await LeaveEntitlement.findOneAndUpdate(
//         { employeeId, year: targetYear },
//         { $set: { casual: 0, sick: 0, annual: 0, maternity: 0, festive: 0 } },
//         { upsert: true, new: true }
//       );
//     }

//     // 1. Casual, Sick, Festive → Always prorated from joining OR Jan 1 (whichever later)
//     const proratedCasual = Math.floor((leavePolicy.casual * totalDaysInPeriod) / totalDaysInYear);
//     const proratedSick = Math.floor((leavePolicy.sick * totalDaysInPeriod) / totalDaysInYear);
//     const proratedFestive = Math.floor((leavePolicy.festive * totalDaysInPeriod) / totalDaysInYear);

//     // 2. Annual Leave: Only after 1 year of service
//     let annual = 0;
//     const oneYearAnniversary = joining.clone().add(1, 'year');

//     if (serviceEndDate.isSameOrAfter(oneYearAnniversary, 'day')) {
//       // Eligible for annual leave

//       const annualEligibleFrom = oneYearAnniversary.isBefore(yearStart)
//         ? yearStart.clone()
//         : oneYearAnniversary.clone();

//       // Cap at periodEnd (in case resigned)
//       const annualEligibleTo = periodEnd;

//       const eligibleDaysForAnnual = annualEligibleTo.diff(annualEligibleFrom, 'days') + 1;

//       if (eligibleDaysForAnnual > 0) {
//         annual = Math.floor((leavePolicy.annual * eligibleDaysForAnnual) / totalDaysInYear);
//       }

//       // Optional: Carry forward from previous year (only for current year)
//       if (targetYear === now.year() && !isSeparated) {
//         const prevEntitlement = await LeaveEntitlement.findOne({ employeeId, year: targetYear - 1 });
//         if (prevEntitlement) {
//           const takenAnnual = await getTakenAnnualLeave(employeeId, targetYear - 1);
//           const unused = prevEntitlement.annual - takenAnnual;
//           const carryForwardMax = 60; // or policy.carryForwardLimit
//           const carryForward = Math.min(unused, carryForwardMax);
//           annual += carryForward > 0 ? carryForward : 0;
//         }
//       }
//     }

//     // 3. Maternity → Only female + full amount if eligible at any point in year
//     const maternity = gender === 'Female' && serviceEndDate.isSameOrAfter(joining) ? leavePolicy.maternity : 0;

//     const result = await LeaveEntitlement.findOneAndUpdate(
//       { employeeId, year: targetYear },
//       {
//         $set: {
//           casual: proratedCasual,
//           sick: proratedSick,
//           annual,
//           maternity,
//           festive: proratedFestive,
//         }
//       },
//       { upsert: true, new: true }
//     );

//     console.log(`Leave Entitlement ${targetYear} | ${employee.fullName} | Casual: ${proratedCasual}, Sick: ${proratedSick}, Annual: ${annual}, Maternity: ${maternity}`);
//     return result;

//   } catch (error) {
//     console.error(`createLeaveEntitlement error for ${employeeId}:`, error.message);
//     throw error;
//   }
// };


exports.createLeaveEntitlement = async (employeeId, joiningDate, specificYear = null) => {
  try {
    const employee = await Employee.findById(employeeId).lean();
    if (!employee) throw new Error('Employee not found');

    const companyId = employee.companyId;
    const gender = employee.gender || 'Male';
    const joining = moment(joiningDate).startOf('day');
    const now = moment().startOf('day');

    const targetYear = specificYear || now.year();

    // === Get or create leave policy for this year ===
    let policy = await LeavePolicy.findOne({ companyId, year: targetYear });
    if (!policy) {
      policy = await new LeavePolicy({
        companyId,
        year: targetYear,
        casual: 12,
        sick: 14,
        annual: 15,
        maternity: 182,
        festive: 11
      }).save();
    }

    const yearStart = moment(`${targetYear}-01-01`).startOf('day');
    const yearEnd = moment(`${targetYear}-12-31`).startOf('day');

    // === Critical: Use exact number of days in the year ===
    const totalDaysInYear = yearEnd.diff(yearStart, 'days') + 1; // 365 or 366

    // === Employee's effective period in this year ===
    const effectiveStart = joining.isAfter(yearStart) ? joining.clone() : yearStart.clone();

    // If employee resigned in this year → cap at lastWorkingDay
    let effectiveEnd = yearEnd.clone();
    if (employee.lastWorkingDay) {
      const lwd = moment(employee.lastWorkingDay).startOf('day');
      if (lwd.isBefore(effectiveEnd)) {
        effectiveEnd = lwd;
      }
    }

    const daysWorkedInYear = effectiveEnd.diff(effectiveStart, 'days') + 1;

    if (daysWorkedInYear <= 0) {
      // No service in this year
      return await LeaveEntitlement.findOneAndUpdate(
        { employeeId, year: targetYear },
        { $set: { casual: 0, sick: 0, annual: 0, maternity: 0, festive: 0 } },
        { upsert: true, new: true }
      );
    }

    // === Prorated Casual, Sick, Festive (from joining date or Jan 1) ===
    const proratedCasual = Math.floor((policy.casual * daysWorkedInYear) / totalDaysInYear);
    const proratedSick = Math.floor((policy.sick * daysWorkedInYear) / totalDaysInYear);
    const proratedFestive = Math.floor((policy.festive * daysWorkedInYear) / totalDaysInYear);

    // === Annual Leave: Only after 1 full year ===
    let annual = 0;
    const oneYearAnniversary = joining.clone().add(1, 'year');

    if (now.isSameOrAfter(oneYearAnniversary, 'day')) {
      const annualStartDate = oneYearAnniversary.isBefore(yearStart)
        ? yearStart.clone()
        : oneYearAnniversary.clone();

      let annualEndDate = yearEnd.clone();
      if (employee.lastWorkingDay) {
        const lwd = moment(employee.lastWorkingDay).startOf('day');
        if (lwd.isBefore(annualEndDate)) annualEndDate = lwd;
      }

      const eligibleDays = annualEndDate.diff(annualStartDate, 'days') + 1;

      if (eligibleDays > 0) {
        annual = Math.floor((policy.annual * eligibleDays) / totalDaysInYear);
      }
    }

    // === Maternity: Only female ===
    const maternity = gender === 'Female' ? policy.maternity : 0;

    // === Save entitlement ===
    const result = await LeaveEntitlement.findOneAndUpdate(
      { employeeId, year: targetYear },
      {
        $set: {
          casual: proratedCasual,
          sick: proratedSick,
          annual,
          maternity,
          festive: proratedFestive,
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(`Entitlement ${targetYear} | ${employee.fullName} | Joined: ${joining.format('YYYY-MM-DD')} | Casual: ${proratedCasual}, Annual: ${annual}`);
    return result;

  } catch (error) {
    console.error('createLeaveEntitlement error:', error.message);
    throw error;
  }
};

async function getTakenAnnualLeave(employeeId, year) {
  const leaves = await LeaveRequest.find({
    employeeId,
    type: 'annual',
    status: 'approved',
    startDate: { $gte: new Date(`${year}-01-01`) },
    endDate: { $lte: new Date(`${year}-12-31`) }
  });

  return leaves.reduce((total, l) => {
    const days = l.isHalfDay ? 0.5 : moment(l.endDate).diff(moment(l.startDate), 'days') + 1;
    return total + days;
  }, 0);
}






// // ================= CREATE LEAVE ENTITLEMENT (MAIN LOGIC) =================
// exports.createLeaveEntitlement = async (employeeId, joiningDate, specificYear = null) => {
//   try {
//     const employee = await Employee.findById(employeeId).lean();
//     if (!employee) throw new Error('Employee not found');

//     const companyId = employee.companyId;
//     const gender = employee.gender;
//     const joining = moment(joiningDate);
//     const targetYear = specificYear || joining.year();

//     // Get or create policy for the target year
//     let leavePolicy = await LeavePolicy.findOne({ companyId, year: targetYear });
//     if (!leavePolicy) {
//       leavePolicy = await new LeavePolicy({ companyId, year: targetYear }).save();
//     }

//     // Days in target year
//     const yearStart = moment(`${targetYear}-01-01`);
//     const yearEnd = yearStart.clone().endOf('year');
//     const totalDaysInYear = yearEnd.diff(yearStart, 'days') + 1;

//     // Employee's start date in this year (either joining date or Jan 1)
//     const employeeStartInYear = joining.isAfter(yearStart) ? joining.clone() : yearStart.clone();
//     const remainingDays = yearEnd.diff(employeeStartInYear, 'days') + 1;

//     // Prorated casual & sick leave (always prorated from joining date or Jan 1)
//     const proratedCasual = Math.round((leavePolicy.casual / totalDaysInYear) * remainingDays);
//     const proratedSick = Math.round((leavePolicy.sick / totalDaysInYear) * remainingDays);
//     const proratedFestive = Math.round((leavePolicy.festive / totalDaysInYear) * remainingDays);

//     // Annual leave: only after 1 year of service
//     let annual = 0;
//     const oneYearCompleted = joining.clone().add(1, 'year');
//     if (moment().isSameOrAfter(oneYearCompleted, 'day')) {
//       // Full annual leave if already completed 1 year at start of this year
//       if (joining.isBefore(yearStart)) {
//         annual = leavePolicy.annual;
//       } else {
//         // Prorated if 1-year milestone falls within this year
//         const daysAfter1Year = yearEnd.diff(oneYearCompleted, 'days') + 1;
//         if (daysAfter1Year > 0) {
//           annual = Math.round((leavePolicy.annual / totalDaysInYear) * daysAfter1Year);
//         }
//       }

//       // Carry forward from previous year (only for current year)
//       if (targetYear === moment().year()) {
//         const prevYear = targetYear - 1;
//         const prevEntitlement = await LeaveEntitlement.findOne({ employeeId, year: prevYear });
//         if (prevEntitlement) {
//           const taken = await LeaveRequest.aggregate([
//             { $match: { employeeId, type: 'annual', status: 'approved', startDate: { $gte: new Date(`${prevYear}-01-01`), $lte: new Date(`${prevYear}-12-31`) } } },
//             { $project: { days: { $add: [ { $divide: [{ $subtract: ['$endDate', '$startDate'] }, 86400000] }, 1 ] }, isHalfDay: 1 } },
//             { $group: { _id: null, total: { $sum: { $cond: ['$isHalfDay', 0.5, '$days'] } } } }
//           ]);
//           const takenAnnual = (taken[0]?.total || 0);
//           const unused = prevEntitlement.annual - takenAnnual;
//           const carryForward = Math.min(Math.max(0, unused), 60); // Max 60 days
//           annual += carryForward;
//         }
//       }
//     }

//     // Maternity: only for females
//     const maternity = gender === 'Female' ? leavePolicy.maternity : 0;

//     // Upsert to avoid duplicate key errors
//     const result = await LeaveEntitlement.findOneAndUpdate(
//       { employeeId, year: targetYear },
//       {
//         $set: {
//           casual: proratedCasual,
//           sick: proratedSick,
//           annual,
//           maternity,
//           festive: proratedFestive,
//           employeeId,
//           year: targetYear
//         }
//       },
//       { upsert: true, new: true, setDefaultsOnInsert: true }
//     );

//     console.log(`Created/Updated entitlement for ${employee.fullName} (${employeeId}) - Year: ${targetYear}, Annual: ${annual}, Casual: ${proratedCasual}`);
//     return result;
//   } catch (error) {
//     console.error(`Error creating entitlement for ${employeeId}:`, error.message);
//     throw error;
//   }
// };

// ================= RECALCULATE ALL ENTITLEMENTS (When joining date changes) =================
// exports.recalculateEmployeeLeaveEntitlements = async (employeeId, newJoiningDate) => {
//   try {
//     await LeaveEntitlement.deleteMany({ employeeId });
//     console.log(`Deleted all entitlements for employee: ${employeeId}`);

//     const joiningYear = moment(newJoiningDate).year();
//     const currentYear = moment().year();

//     for (let year = joiningYear; year <= currentYear; year++) {
//       await exports.createLeaveEntitlement(employeeId, newJoiningDate, year);
//     }

//     console.log(`Recalculated entitlements for ${employeeId} from ${newJoiningDate}`);
//   } catch (error) {
//     console.error(`Error recalculating entitlements:`, error);
//     throw error;
//   }
// };

exports.recalculateEmployeeLeaveEntitlements = async (employeeId, newJoiningDate) => {
  try {
    console.log(`RE-CALCULATING LEAVE ENTITLEMENT FOR EMPLOYEE: ${employeeId}`);
    console.log(`New Joining Date: ${newJoiningDate}`);

    // STEP 1: HARD DELETE ALL ENTITLEMENTS (no soft, no filter miss)
    const deleteResult = await LeaveEntitlement.deleteMany({ employeeId: employeeId });
    console.log(`Deleted ${deleteResult.deletedCount} old entitlement records`);

    if (deleteResult.deletedCount === 0) {
      console.log("No old records found — this is first time or already clean");
    }

    const joiningYear = moment(newJoiningDate).year();
    const currentYear = moment().year();

    console.log(`Will recreate entitlements from ${joiningYear} to ${currentYear}`);

    // STEP 2: Recreate for every year
    for (let year = joiningYear; year <= currentYear; year++) {
      console.log(`Creating entitlement for year: ${year}`);
      await exports.createLeaveEntitlement(employeeId, newJoiningDate, year);
    }

    console.log(`SUCCESS: All leave entitlements recalculated for employee ${employeeId}`);
  } catch (error) {
    console.error('FATAL: recalculateEmployeeLeaveEntitlements failed:', error);
    throw error;
  }
};

exports.getLeaveEntitlement = async (req, res) => {
  try {
    const requestedEmployeeId = req.params.employeeId;
    const year = req.query.year || moment().year();
    const requestingUser = req.user;

    let employeeIdToFetch;

    // If an employeeId is provided in the params, it means a user is trying to fetch another user's entitlement
    if (requestedEmployeeId) {
      // Check if the requesting user has the appropriate role to view other users' entitlements
      if (!['HR Manager', 'Super Admin', 'Company Admin'].includes(requestingUser.role)) {
        // If not an admin/HR, they can only view their own entitlement
        if (requestedEmployeeId !== requestingUser.employeeId.toString()) {
          return res.status(403).json({ success: false, error: 'Access denied. You can only view your own entitlements.' });
        }
      }
      employeeIdToFetch = requestedEmployeeId;
    } else {
      // If no employeeId is provided, the user is fetching their own entitlement
      employeeIdToFetch = requestingUser.employeeId;
    }

    const entitlement = await LeaveEntitlement.findOne({ employeeId: employeeIdToFetch, year });

    if (!entitlement) {
      return res.status(404).json({ success: false, error: 'Leave entitlement not found' });
    }

    res.status(200).json({ success: true, data: entitlement });
  } catch (error) {
    console.error(`❌ Error getting leave entitlement: ${error.message}`);
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.updateLeaveEntitlement = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { year, ...updatedValues } = req.body;

    const entitlement = await LeaveEntitlement.findOneAndUpdate(
      { employeeId, year: year || moment().year() },
      { $set: updatedValues },
      { new: true, runValidators: true }
    );

    if (!entitlement) {
      return res.status(404).json({ success: false, error: 'Leave entitlement not found to update' });
    }

    res.status(200).json({ success: true, data: entitlement });
  } catch (error) {
    console.error(`❌ Error updating leave entitlement: ${error.message}`);
    res.status(400).json({ success: false, error: error.message });
  }
};

// ================= Leave Policy Functions =================
exports.getLeavePolicy = async (req, res) => {
  try {
    const targetCompanyId = req.query.companyId || req.user.companyId;
    const targetYear = req.query.year || moment().year(); // Get year from query parameter or current year

    if (!targetCompanyId) {
      return res.status(400).json({ success: false, error: 'Company ID is required.' });
    }

    const policy = await LeavePolicy.findOne({ companyId: targetCompanyId, year: targetYear });
    if (!policy) {
      // If no policy exists, create a default one for the targetCompanyId and targetYear
      const newPolicy = new LeavePolicy({ companyId: targetCompanyId, year: targetYear });
      await newPolicy.save();
      return res.status(200).json({ success: true, data: newPolicy });
    }
    res.status(200).json({ success: true, data: policy });
  } catch (error) {
    console.error(`❌ Error getting leave policy: ${error.message}`);
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.updateLeavePolicy = async (req, res) => {
  try {
    const targetCompanyId = req.params.companyId; // Company ID from URL parameter
    const targetYear = req.body.year || moment().year(); // Get year from request body or current year

    if (!targetCompanyId) {
      return res.status(400).json({ success: false, error: 'Company ID is required.' });
    }

    const policy = await LeavePolicy.findOneAndUpdate(
      { companyId: targetCompanyId, year: targetYear },
      { $set: req.body },
      { new: true, runValidators: true, upsert: true }
    );
    res.status(200).json({ success: true, data: policy });
  } catch (error) {
    console.error(`❌ Error updating leave policy: ${error.message}`);
    res.status(400).json({ success: false, error: error.message });
  }
};

// ================= Generate Missing Leave Entitlements =================
exports.generateMissingLeaveEntitlements = async (req, res) => {
  try {
    const currentYear = moment().year();
    const employees = await Employee.find({ companyId: req.user.companyId, employeeStatus: 'active' });
    let generatedCount = 0;

    for (const employee of employees) {
      const existingEntitlement = await LeaveEntitlement.findOne({ employeeId: employee._id, year: currentYear });
      if (!existingEntitlement && employee.joiningDate) {
        await exports.createLeaveEntitlement(employee._id, employee.joiningDate);
        generatedCount++;
      }
    }

    res.status(200).json({ success: true, message: `Generated ${generatedCount} missing leave entitlements for ${currentYear}.` });
  } catch (error) {
    console.error(`❌ Error generating missing leave entitlements: ${error.message}`);
    res.status(400).json({ success: false, error: error.message });
  }
};

// ================= Annual Leave Encashment =================
exports.encashAnnualLeave = async (req, res) => {
  try {
    const employeeId = req.user.employeeId;
    const currentYear = moment().year();

    const entitlement = await LeaveEntitlement.findOne({ employeeId, year: currentYear });
    if (!entitlement) {
      return res.status(404).json({ success: false, error: 'Leave entitlement not found for current year.' });
    }

    // Check if encashment has already been done this year
    if (entitlement.lastEncashmentDate && moment(entitlement.lastEncashmentDate).year() === currentYear) {
      return res.status(400).json({ success: false, error: 'Annual leave encashment can only be done once a year.' });
    }

    // Calculate unused annual leave
    const leavesTakenThisYear = await LeaveRequest.find({
      employeeId,
      status: 'approved',
      type: 'annual',
      $expr: { $eq: [{ $year: "$startDate" }, currentYear] }
    });

    let annualLeaveTaken = 0;
    for (const leave of leavesTakenThisYear) {
      const duration = leave.isHalfDay ? 0.5 : (moment(leave.endDate).diff(moment(leave.startDate), 'days') + 1);
      annualLeaveTaken += duration;
    }

    const unusedAnnualLeave = entitlement.annual - annualLeaveTaken;

    // Ensure no more than half of the total earned leave can be encashed
    const maxEncashableLeave = entitlement.annual / 2;
    const amountToEncash = Math.min(unusedAnnualLeave, maxEncashableLeave);

    if (amountToEncash <= 0) {
      return res.status(400).json({ success: false, error: 'No annual leave available for encashment.' });
    }

    // Update entitlement
    entitlement.annual -= amountToEncash; // Deduct encashed leave from annual balance
    entitlement.lastEncashmentDate = new Date(); // Set encashment date
    await entitlement.save();

    res.status(200).json({
      success: true,
      message: `${amountToEncash} days of annual leave encashed successfully.`,
      data: entitlement
    });

  } catch (error) {
    console.error(`❌ Error encashing annual leave: ${error.message}`);
    res.status(400).json({ success: false, error: error.message });
  }
};
