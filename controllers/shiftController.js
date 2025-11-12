const Shift = require('../models/shift');
const Employee = require('../models/employee');
const Company = require('../models/company');

// Create a new shift
exports.createShift = async (req, res) => {
  console.log('createShift req.body', req.body);
  try {
    const { name, startTime, endTime, gracePeriod, overtimeThreshold,companyId } = req.body;
    // const companyId = req.user.companyId; // Assuming companyId is available from authenticated user

    // Verify company exists
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ success: false, error: 'Company not found.' });
    }

    // Check for existing shift with the same time
    const existingShift = await Shift.findOne({ companyId, startTime, endTime });
    if (existingShift) {
      return res.status(400).json({ success: false, error: 'A shift with these start and end times already exists for this company.' });
    }

    // Calculate working hours
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    let totalMinutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
    if (totalMinutes < 0) {
      totalMinutes += 24 * 60; // Handle shifts crossing midnight
    }
    const workingHours = parseFloat((totalMinutes / 60).toFixed(2));
    console.log('createShift workingHours', workingHours);

    const newShift = new Shift({
      companyId,
      name,
      startTime,
      endTime,
      gracePeriod: gracePeriod || 0,
      overtimeThreshold: overtimeThreshold || 0,
      workingHours
    });

    await newShift.save();
    res.status(201).json({ success: true, data: newShift });
  } catch (error) {
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
    const { startTime, endTime, gracePeriod, overtimeThreshold } = req.body;

    // Find the original shift to get its companyId
    const originalShift = await Shift.findById(id);
    if (!originalShift) {
      return res.status(404).json({ success: false, error: 'Shift not found.' });
    }

    const updateData = {};

    if (startTime) updateData.startTime = startTime;
    if (endTime) updateData.endTime = endTime;
    if (gracePeriod !== undefined) updateData.gracePeriod = gracePeriod;
    if (overtimeThreshold !== undefined) updateData.overtimeThreshold = overtimeThreshold;

    // Check for existing shift with the same time
    if (startTime && endTime) {
      const existingShift = await Shift.findOne({
        _id: { $ne: id },
        companyId: originalShift.companyId,
        startTime,
        endTime
      });
      if (existingShift) {
        return res.status(400).json({ success: false, error: 'Another shift with these start and end times already exists for this company.' });
      }
    }

    // Calculate working hours if startTime or endTime are provided
    if (startTime && endTime) {
      const [startHour, startMinute] = startTime.split(':').map(Number);
      const [endHour, endMinute] = endTime.split(':').map(Number);

      let totalMinutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
      if (totalMinutes < 0) {
        totalMinutes += 24 * 60; // Handle shifts crossing midnight
      }
      updateData.workingHours = parseFloat((totalMinutes / 60).toFixed(2));
    } else if (startTime || endTime) {
        return res.status(400).json({ success: false, error: 'Both startTime and endTime must be provided to recalculate working hours.' });
    }

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
    if (error.code === 11000) {
      return res.status(400).json({ success: false, error: 'Shift with this name already exists for the company.' });
    }
    res.status(400).json({ success: false, error: error });
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
