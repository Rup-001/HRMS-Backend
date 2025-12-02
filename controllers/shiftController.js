const Shift = require('../models/shift');
const Employee = require('../models/employee');
const Company = require('../models/company');



// Create a new shift
exports.createShift = async (req, res) => {
  console.log('createShift req.body', req.body);
  try {
    const { name, startTime, endTime, gracePeriod, overtimeThreshold, companyId } = req.body;

    // ---- 1. Validate required fields ----
    if (!name || !startTime || !endTime || !companyId) {
      return res.status(400).json({ success: false, error: 'name, startTime, endTime and companyId are required.' });
    }

    // ---- 2. Verify company exists ----
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ success: false, error: 'Company not found.' });
    }

    // ---- 3. Check for duplicate shift (same start & end) ----
    const existingShift = await Shift.findOne({ companyId, startTime, endTime });
    if (existingShift) {
      return res.status(400).json({ success: false, error: 'A shift with these start and end times already exists for this company.' });
    }

    // ---- 4. Parse times ----
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour,   endMinute]   = endTime.split(':').map(Number);

    // Validate that the split produced numbers
    if (isNaN(startHour) || isNaN(startMinute) || isNaN(endHour) || isNaN(endMinute)) {
      return res.status(400).json({ success: false, error: 'Invalid time format. Use HH:MM (24-hour).' });
    }

    // ---- 5. Calculate working hours (with midnight-crossing fix) ----
    let totalMinutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);

    // **THIS IS THE LINE YOU ASKED FOR**
    if (totalMinutes <= 0) totalMinutes += 24 * 60;   // <= 0 instead of < 0

    const workingHours = parseFloat((totalMinutes / 60).toFixed(2));
    console.log('createShift workingHours', workingHours);

    // ---- 6. Create the shift document ----
    const weekendDaysArray = req.body.weekendDays ? JSON.parse(req.body.weekendDays) : [5, 6];
    const newShift = new Shift({
      companyId,
      name,
      startTime,
      endTime,
      gracePeriod: gracePeriod ?? 0,          // default 0 if not sent
      overtimeThreshold: overtimeThreshold ?? 0,
      workingHours,
      weekendDays: weekendDaysArray
    });

    await newShift.save();

    res.status(201).json({ success: true, data: newShift });
  } catch (error) {
    console.error('createShift error:', error);

    // Duplicate name (unique index on name + companyId)
    if (error.code === 11000) {
      return res.status(400).json({ success: false, error: 'Shift with this name already exists for the company.' });
    }

    res.status(400).json({ success: false, error: error.message });
  }
};

// Get all shifts for a company
exports.getAllShifts = async (req, res) => {
  try {
    let query = {};
    if (req.query.companyId) {
      query.companyId = req.query.companyId;
    }
    const shifts = await Shift.find(query)
      .select('name startTime endTime workingHours gracePeriod overtimeThreshold weekendDays companyId')
      .populate("companyId", 'name');
    
    res.status(200).json({ success: true, data: shifts });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// Get a single shift by ID
exports.getShiftById = async (req, res) => {
  try {
    const { id } = req.params;
    // const companyId = req.user.companyId;
    // if (!companyId) {
    //   return res.status(403).json({ success: false, error: 'User is not associated with a company.' });
    // }
    const shift = await Shift.findOne({ _id: id });
    if (!shift) {
      return res.status(404).json({ success: false, error: 'Shift not found.' });
    }
    res.status(200).json({ success: true, data: shift });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};


// Update a shift
exports.updateShift = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, startTime, endTime, gracePeriod, overtimeThreshold } = req.body;

    // ---- 1. Find original shift (to get companyId) ----
    const originalShift = await Shift.findById(id);
    if (!originalShift) {
      return res.status(404).json({ success: false, error: 'Shift not found.' });
    }

    const updateData = {};

    // ---- 2. Only update fields that are provided ----
    if (name !== undefined) updateData.name = name;
    if (gracePeriod !== undefined) updateData.gracePeriod = gracePeriod;
    if (overtimeThreshold !== undefined) updateData.overtimeThreshold = overtimeThreshold;
    if (req.body.weekendDays !== undefined) {
      updateData.weekendDays = Array.isArray(req.body.weekendDays) 
        ? req.body.weekendDays 
        : JSON.parse(req.body.weekendDays);
    }

    // ---- 3. Handle startTime & endTime together (required for workingHours) ----
    if (startTime && endTime) {
      // Validate format
      const [sh, sm] = startTime.split(':').map(Number);
      const [eh, em] = endTime.split(':').map(Number);
      if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) {
        return res.status(400).json({ success: false, error: 'Invalid time format. Use HH:MM.' });
      }

      // Check for duplicate (exclude current shift)
      const existing = await Shift.findOne({
        _id: { $ne: id },
        companyId: originalShift.companyId,
        startTime,
        endTime
      });
      if (existing) {
        return res.status(400).json({ success: false, error: 'Another shift with these times already exists.' });
      }

      // ---- 4. Recalculate workingHours (with <= 0 fix) ----
      let totalMinutes = (eh * 60 + em) - (sh * 60 + sm);
      if (totalMinutes <= 0) totalMinutes += 24 * 60;  // <= 0 FIX

      const workingHours = parseFloat((totalMinutes / 60).toFixed(2));

      updateData.startTime = startTime;
      updateData.endTime = endTime;
      updateData.workingHours = workingHours;

    } else if (startTime || endTime) {
      // If only one is sent → error
      return res.status(400).json({ success: false, error: 'Both startTime and endTime must be provided to update shift times.' });
    }

    // ---- 5. Update the shift ----
    const updatedShift = await Shift.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedShift) {
      return res.status(404).json({ success: false, error: 'Shift not found.' });
    }

    res.status(200).json({ success: true, data: updatedShift });
  } catch (error) {
    console.error('updateShift error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, error: 'Shift with this name already exists for the company.' });
    }
    res.status(400).json({ success: false, error: error.message });
  }
};

// Delete a shift
exports.deleteShift = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.companyId;
    // if (!companyId) {
    //   return res.status(403).json({ success: false, error: 'User is not associated with a company.' });
    // }

    // Check if any employees are assigned to this shift
    const assignedEmployees = await Employee.countDocuments({ shiftId: id });
    if (assignedEmployees > 0) {
      return res.status(400).json({ success: false, error: `Cannot delete shift. ${assignedEmployees} employee(s) are currently assigned to it.` });
    }

    const deletedShift = await Shift.findOneAndDelete({ _id: id, companyId });

    if (!deletedShift) {
      return res.status(404).json({ success: false, error: 'Shift not found.' });
    }
    res.status(200).json({ success: true, message: 'Shift deleted successfully.' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// Assign a shift to multiple employees
exports.assignShiftToEmployees = async (req, res) => {
  try {
    const { shiftId, employeeIds, companyId } = req.body;

    if (!Array.isArray(employeeIds)) {
      return res.status(400).json({ success: false, error: 'employeeIds must be an array.' });
    }

    if (!companyId) {
      return res.status(400).json({ success: false, error: 'Company ID is required.' });
    }

    // Validate shift
    const shift = await Shift.findOne({ _id: shiftId, companyId });
    if (!shift) {
      return res.status(404).json({ success: false, error: 'Shift not found in the specified company.' });
    }

    // Validate employees
    const employees = await Employee.find({ _id: { $in: employeeIds }, companyId });
    if (employees.length !== employeeIds.length) {
      return res.status(404).json({ success: false, error: 'One or more employees were not found in the specified company.' });
    }

    // Assign shift to employees
    await Employee.updateMany({ _id: { $in: employeeIds }, companyId }, { $set: { shiftId } });

    res.status(200).json({ success: true, message: 'Shift assigned to employees successfully.' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// Remove an employee from a shift
exports.removeEmployeeFromShift = async (req, res) => {
  try {
    const { employeeId } = req.params;

    // Validate employee
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, error: 'Employee not found.' });
    }

    // Remove shift from employee
    await Employee.updateOne({ _id: employeeId }, { $unset: { shiftId: "" } });

    res.status(200).json({ success: true, message: 'Employee removed from shift successfully.' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};
exports.getEmployees = async (req, res) => {
  try {
    const { companyId, employeeId, shiftId } = req.query;
    const query = {};

    if (companyId) query.companyId = companyId;
    if (employeeId) query._id = employeeId;
    if (shiftId) query.shiftId = shiftId;

    // ✅ Corrected populate usage:
    // Each populate only takes 2 arguments (path, fields)
    const employees = await Employee.find(query)
      .populate('designation', 'name')
      .populate('shiftId', 'name startTime endTime workingHours');

    res.status(200).json({ success: true, data: employees });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(400).json({ success: false, error: error.message });
  }
};


// // Get all employees for a given shift
// exports.getEmployees = async (req, res) => {
//   try {
//     const { companyId, employeeId, shiftId } = req.query;

//     let query = {};

//     if (companyId) {
//       query.companyId = companyId;
//     }

//     if (employeeId) {
//       query._id = employeeId;
//     }

//     if (shiftId) {
//       query.shiftId = shiftId;
//     }

//     const employees = await Employee.find(query).populate('designation', 'name', 'shiftId');
//     res.status(200).json({ success: true, data: employees });
//   } catch (error) {
//     res.status(400).json({ success: false, error: error.message });
//   }
// };
