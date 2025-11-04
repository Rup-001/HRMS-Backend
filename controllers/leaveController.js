
const LeaveRequest = require('../models/leaveRequest');
const LeaveEntitlement = require('../models/leaveEntitlement');
const LeavePolicy = require('../models/leavePolicy');
const EmployeesAttendance = require('../models/employeesAttendance');
const Employee = require('../models/employee');
const moment = require('moment-timezone');

exports.createLeaveRequest = async (req, res) => {
  try {
    const { startDate, endDate, type, isHalfDay } = req.body;
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

    // Check leave entitlement
    if (type !== 'remote') { // Remote work does not deduct from leave balance
      const year = moment(start).year();
      const entitlement = await LeaveEntitlement.findOne({ employeeId: req.user.employeeId, year });

      if (!entitlement) {
        return res.status(400).json({ success: false, error: 'Leave entitlement not found for current year.' });
      }

      // Calculate leave taken for the current year
      const approvedLeaves = await LeaveRequest.find({
        employeeId: req.user.employeeId,
        status: 'approved',
        type: type,
        $expr: { $eq: [{ $year: "$startDate" }, year] }
      });

      let leaveTaken = 0;
      for (const leave of approvedLeaves) {
        leaveTaken += leave.isHalfDay ? 0.5 : (moment(leave.endDate).diff(moment(leave.startDate), 'days') + 1);
      }

      const availableLeave = entitlement[type] - leaveTaken;

      if (availableLeave < (isHalfDay ? 0.5 : leaveDuration)) {
        return res.status(400).json({ success: false, error: `Insufficient ${type} leave. Available: ${availableLeave} days.` });
      }
    }

    const leaveRequest = new LeaveRequest({
      companyId: req.user.companyId,
      employeeId: req.user.employeeId,
      startDate: start,
      endDate: end,
      type,
      isHalfDay,
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
    leaveRequest.status = 'approved';
    leaveRequest.approverId = req.user.employeeId;
    await leaveRequest.save();

    // Deduct leave from entitlement
    const leaveDuration = moment(leaveRequest.endDate).diff(moment(leaveRequest.startDate), 'days') + 1;
    const leaveType = leaveRequest.type;
    const year = moment(leaveRequest.startDate).year();

    if (leaveType !== 'remote') { // Do not deduct for remote work
      const entitlement = await LeaveEntitlement.findOne({ employeeId: leaveRequest.employeeId, year });
      if (entitlement && entitlement[leaveType] !== undefined) {
        entitlement[leaveType] -= leaveRequest.isHalfDay ? 0.5 : leaveDuration;
        await entitlement.save();
        console.log(`✅ Deducted ${leaveRequest.isHalfDay ? 0.5 : leaveDuration} days of ${leaveType} leave for employee ${leaveRequest.employeeId}`);
      }
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

// exports.getLeaveRequests = async (req, res) => {
//   try {
//     const query = req.user.role === 'Employee' 
//       ? { employeeId: req.user.employeeId, companyId: req.user.companyId } 
//       : req.user.role === 'Manager' 
//       ? { approverId: req.user.employeeId, companyId: req.user.companyId } 
//       : { companyId: req.user.companyId };
//     const leaveRequests = await LeaveRequest.find(query)
//       .populate('employeeId', 'fullName newEmployeeCode')
//       .populate('approverId', 'fullName');
//     console.log(`✅ Retrieved ${leaveRequests.length} leave requests for user: ${req.user.employeeId}, role: ${req.user.role}`);
//     res.status(200).json({ success: true, data: leaveRequests });
//   } catch (error) {
//     console.error(`❌ Error retrieving leave requests: ${error.message}`);
//     res.status(400).json({ success: false, error: error.message });
//   }
// };


// exports.getLeaveRequests = async (req, res) => {
//   try {
//     let query;

//     if (req.user.role === 'Employee') {
//       query = { employeeId: req.user.employeeId, companyId: req.user.companyId };
//     } else if (req.user.role === 'Manager') {
//       query = { approverId: req.user.employeeId, companyId: req.user.companyId };
//     } else if (['Super Admin', 'C-Level Executive'].includes(req.user.role)) {
//       // ✅ Super Admin & C Level Executive see everything in their company
//       query = { companyId: req.user.companyId };
//     } else {
//       // Default fallback: restrict to their own company (if you have other roles)
//       query = { companyId: req.user.companyId };
//     }

//     const leaveRequests = await LeaveRequest.find(query)
//       .populate('employeeId', 'fullName newEmployeeCode')
//       .populate('approverId', 'fullName');

//     console.log(`✅ Retrieved ${leaveRequests.length} leave requests for user: ${req.user.employeeId}, role: ${req.user.role}`);
//     res.status(200).json({ success: true, data: leaveRequests });
//   } catch (error) {
//     console.error(`❌ Error retrieving leave requests: ${error.message}`);
//     res.status(400).json({ success: false, error: error.message });
//   }
// };


exports.getLeaveRequests = async (req, res) => {
  try {
    let query;

    if (req.user.role === 'Employee') {
      // 🧍 Employee → only their own leave requests
      query = { employeeId: req.user.employeeId, companyId: req.user.companyId };
    } else if (req.user.role === 'Manager') {
      // 👨‍💼 Manager → only those they need to approve
      query = { approverId: req.user.employeeId, companyId: req.user.companyId };
    } else if (req.user.role === 'Super Admin') {
      // 🧑‍💻 Super Admin → all requests within their company
      query = { companyId: req.user.companyId };
    } else if (req.user.role === 'C-Level Executive') {
      // 🏢 C Level Executive → all requests across all companies
      query = {}; // ✅ No filter = see everything
    } else {
      // 🛡️ Default: restrict to same company
      query = { companyId: req.user.companyId };
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

// exports.getLeaveSummary = async (req, res) => {
//   try {
//     const employeeId = req.user.employeeId;
//     const year = req.query.year || moment().year();

//     const entitlement = await LeaveEntitlement.findOne({ employeeId, year });
//     if (!entitlement) {
//       return res.status(404).json({ success: false, error: 'Leave entitlement not found for the specified year' });
//     }

//     const approvedLeaves = await LeaveRequest.find({
//       employeeId,
//       status: 'approved',
//       $expr: { $eq: [{ $year: "$startDate" }, year] }
//     });

//     const leaveTaken = {
//       casual: 0,
//       sick: 0,
//       earned: 0,
//       maternity: 0,
//       paternity: 0,
//       bereavement: 0
//     };

//     for (const leave of approvedLeaves) {
//       if (leave.type !== 'remote') {
//         const duration = moment(leave.endDate).diff(moment(leave.startDate), 'days') + 1;
//         leaveTaken[leave.type] += leave.isHalfDay ? 0.5 : duration;
//       }
//     }

//     const summary = {
//       year,
//       entitlement: entitlement.toObject(),
//       leaveTaken,
//       balance: {
//         casual: entitlement.casual - leaveTaken.casual,
//         sick: entitlement.sick - leaveTaken.sick,
//         earned: entitlement.earned - leaveTaken.earned,
//         maternity: entitlement.maternity - leaveTaken.maternity,
//         paternity: entitlement.paternity - leaveTaken.paternity,
//         bereavement: entitlement.bereavement - leaveTaken.bereavement
//       }
//     };

//     res.status(200).json({ success: true, data: summary });
//   } catch (error) {
//     console.error(`❌ Error getting leave summary: ${error.message}`);
//     res.status(400).json({ success: false, error: error.message });
//   }
// };

exports.getLeaveSummary = async (req, res) => {
  try {
    const { year, employeeId: queryEmployeeId } = req.query;
    const requestingUser = req.user;

    let employeeId;
    if (['Super Admin', 'HR Manager'].includes(requestingUser.role) && queryEmployeeId) {
      employeeId = queryEmployeeId;
    } else {
      employeeId = requestingUser.employeeId;
    }

    const summaryYear = year || moment().year();

    let entitlement = await LeaveEntitlement.findOne({ employeeId, year: summaryYear });
    if (!entitlement) {
      entitlement = {
        casual: 0,
        sick: 0,
        earned: 0,
        maternity: 0,
        paternity: 0,
        bereavement: 0,
        festive: 0,
      };
    }

    const approvedLeaves = await LeaveRequest.find({
      employeeId,
      status: 'approved',
      $expr: { $eq: [{ $year: "$startDate" }, parseInt(summaryYear)] }
    });

    const leaveTaken = {
      casual: 0,
      sick: 0,
      earned: 0,
      maternity: 0,
      paternity: 0,
      bereavement: 0
    };

    for (const leave of approvedLeaves) {
      if (leave.type !== 'remote') {
        const duration = moment(leave.endDate).diff(moment(leave.startDate), 'days') + 1;
        leaveTaken[leave.type] += leave.isHalfDay ? 0.5 : duration;
      }
    }

    const summary = {
      year: summaryYear,
      entitlement: entitlement,
      leaveTaken,
      balance: {
        casual: entitlement.casual - leaveTaken.casual,
        sick: entitlement.sick - leaveTaken.sick,
        earned: entitlement.earned - leaveTaken.earned,
        maternity: entitlement.maternity - leaveTaken.maternity,
        paternity: entitlement.paternity - leaveTaken.paternity,
        bereavement: entitlement.bereavement - leaveTaken.bereavement
      }
    };

    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    console.error(`❌ Error getting leave summary: ${error.message}`);
    res.status(400).json({ success: false, error: error.message });
  }
};

// ================= Leave Entitlement Functions =================
exports.createLeaveEntitlement = async (employeeId, joiningDate) => {
  try {
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      throw new Error('Employee not found');
    }

    const companyId = employee.companyId;
    let leavePolicy = await LeavePolicy.findOne({ companyId });

    if (!leavePolicy) {
      // If no policy exists for the company, create a default one
      leavePolicy = new LeavePolicy({ companyId });
      await leavePolicy.save();
    }

    const year = moment(joiningDate).year();
    const startOfYear = moment(joiningDate).startOf('year');
    const daysInYear = moment(joiningDate).isLeapYear() ? 366 : 365;
    const remainingDays = daysInYear - moment(joiningDate).dayOfYear();

    const proratedCasual = Math.round((leavePolicy.casual / daysInYear) * remainingDays);
    const proratedSick = Math.round((leavePolicy.sick / daysInYear) * remainingDays);
    const proratedEarned = Math.round((leavePolicy.earned / daysInYear) * remainingDays);

    const newEntitlement = new LeaveEntitlement({
      employeeId,
      year,
      casual: proratedCasual,
      sick: proratedSick,
      earned: proratedEarned,
      maternity: leavePolicy.maternity,
      paternity: leavePolicy.paternity,
      bereavement: leavePolicy.bereavement,
      festive: leavePolicy.festive
    });

    await newEntitlement.save();
    console.log(`✅ Created leave entitlement for employee: ${employeeId}`);
    return newEntitlement;
  } catch (error) {
    console.error(`❌ Error creating leave entitlement: ${error.message}`);
    throw error;
  }
};

exports.getLeaveEntitlement = async (req, res) => {
  try {
    const employeeId = req.params.employeeId || req.user.employeeId;
    const year = req.query.year || moment().year();

    const entitlement = await LeaveEntitlement.findOne({ employeeId, year });
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
    const policy = await LeavePolicy.findOne({ companyId: req.user.companyId });
    if (!policy) {
      // If no policy exists, create a default one
      const newPolicy = new LeavePolicy({ companyId: req.user.companyId });
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
    const policy = await LeavePolicy.findOneAndUpdate(
      { companyId: req.user.companyId },
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
