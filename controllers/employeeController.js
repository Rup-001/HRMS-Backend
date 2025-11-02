const Employee = require('../models/employee');
const User = require('../models/user');
const Invitation = require('../models/Invitation');
const Company = require('../models/company');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const moment = require('moment-timezone');
const fs = require('fs').promises;
const path = require('path');

const zkService = require('../services/zktecoService');
const leaveController = require('./leaveController');

const transporter = nodemailer.createTransport({
  host: 'smtp.zoho.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.ZOHO_EMAIL,
    pass: process.env.ZOHO_PASSWORD
  }
});

// ================= CREATE EMPLOYEE =================



exports.createEmployee = async (req, res) => {
  let employee = null;
  let uploadedFiles = {};

  const maxAttempts = 5;               // how many times we retry on duplicate key
  let attempt = 0;

  try {
    console.log('createEmployee - Request body:', req.body);
    console.log('createEmployee - Files:', req.files);

    const {
      fullName,
      email,
      role,
      companyId,
      joiningDate,
      department,
      designation,
      createUser = false,
      createDeviceUser = false,
    } = req.body;

    // ---------- VALIDATION ----------
    if (!fullName || !companyId) {
      throw new Error('Missing mandatory fields: fullName, companyId');
    }

    const company = await Company.findOne({ _id: companyId, isActive: true });
    if (!company) throw new Error('Company not found or inactive');
    if (!company.employeeIdBase) {
      throw new Error('Company is not configured for automatic employee ID generation.');
    }

    const basePrefix = company.employeeIdBase.toString();
    // const finalRole = req.user.role === 'Super Admin' && role ? role : 'Employee';
const allowedToSetRole = ['Super Admin', 'HR Manager'].includes(req.user.role);
const finalRole = allowedToSetRole && role ? role : 'Employee';
    // ---------- FILE UPLOAD ----------
    const fileFields = ['passportSizePhoto', 'appointmentLetter', 'resume', 'nidCopy'];
    for (const field of fileFields) {
      if (req.files?.[field]) {
        const file = req.files[field][0];
        const filePath = file.path.replace(/\\/g, '/');
        console.log(`createEmployee - ${field} saved:`, filePath);
        uploadedFiles[field] = filePath;
      }
    }

    // ---------- RETRY LOOP (handles race condition) ----------
    while (attempt < maxAttempts) {
      attempt++;

      try {
        // ----- 1. Determine sequential number -----
        let minSeq, maxSeq;
        if (finalRole === 'C-Level Executive') {
          minSeq = 1;   // 20001-20050
          maxSeq = 50;
        } else {
          minSeq = 51;  // 20051 onward
          maxSeq = null;
        }

        // Find the highest existing code in the proper range
        const lastEmployee = await Employee.findOne({
          companyId,
          newEmployeeCode: new RegExp(`^${basePrefix}\\d+`),
          ...(finalRole === 'C-Level Executive' && {
            newEmployeeCode: {
              $gte: `${basePrefix}${String(minSeq).padStart(2, '0')}`,
              $lte: `${basePrefix}${String(maxSeq).padStart(2, '0')}`,
            },
          }),
        }).sort({ newEmployeeCode: -1 });

        let sequentialNumber;
        if (lastEmployee) {
          const lastSeqStr = lastEmployee.newEmployeeCode.substring(basePrefix.length);
          sequentialNumber = parseInt(lastSeqStr, 10) + 1;
        } else {
          sequentialNumber = minSeq;
        }

        // ----- 2. Enforce C-Level limit -----
        if (finalRole === 'C-Level Executive' && sequentialNumber > maxSeq) {
          throw new Error('No available C-Level Executive IDs remaining for this company.');
        }

        // ----- 3. Build the code (always 2-digit padding) -----
        const newEmployeeCode = `${basePrefix}${String(sequentialNumber).padStart(2, '0')}`;

        // ----- 4. Create & SAVE the employee (unique index will enforce) -----
        employee = new Employee({
          fullName,
          newEmployeeCode,
          email,
          role: finalRole,
          companyId,
          joiningDate,
          department,
          designation,
          employeeStatus: 'active',
          passportSizePhoto: uploadedFiles.passportSizePhoto
            ? `/${uploadedFiles.passportSizePhoto}`
            : undefined,
          appointmentLetter: uploadedFiles.appointmentLetter
            ? `/${uploadedFiles.appointmentLetter}`
            : undefined,
          resume: uploadedFiles.resume ? `/${uploadedFiles.resume}` : undefined,
          nidCopy: uploadedFiles.nidCopy ? `/${uploadedFiles.nidCopy}` : undefined,
          hasUserAccount: createUser,
        });

        await employee.save();          // <-- DB will throw 11000 on duplicate
        console.log('Employee saved with code:', newEmployeeCode);
        break;                          // SUCCESS → exit retry loop

      } catch (saveErr) {
        // ----- HANDLE DUPLICATE KEY (race condition) -----
        if (
          saveErr.name === 'MongoServerError' &&
          saveErr.code === 11000 &&
          saveErr.message.includes('newEmployeeCode')
        ) {
          console.warn(
            `Duplicate employee code on attempt ${attempt}. Retrying...`
          );
          // Loop will recalculate the next ID on the next iteration
          continue;
        }
        // Any other error → bubble up
        throw saveErr;
      }
    }

    if (attempt >= maxAttempts) {
      throw new Error(
        'Failed to generate a unique employee code after several attempts.'
      );
    }

    // ---------- POST-SAVE ACTIONS (leave entitlement, device user, user account) ----------
    if (employee.joiningDate) {
      try {
        await leaveController.createLeaveEntitlement(employee._id, employee.joiningDate);
      } catch (e) {
        console.error('Leave entitlement error (non-fatal):', e.message);
      }
    }

    if (createDeviceUser === true || createDeviceUser === 'true') {
      try {
        await zkService.setUser(employee.newEmployeeCode, employee.fullName);
      } catch (e) {
        console.error('Device user creation error (non-fatal):', e.message);
      }
    }

    if (createUser === true || createUser === 'true') {
      if (!email) throw new Error('Email required to create user');

      const temporaryPassword = crypto.randomBytes(8).toString('hex');
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = moment().add(7, 'days').toDate();

      const user = new User({
        companyId,
        employeeId: employee._id,
        email,
        password: temporaryPassword,
        role: finalRole,
        invitationStatus: 'sent',
      });
      await user.save();

      const invitation = new Invitation({
        companyId,
        employeeId: employee._id,
        email,
        token,
        temporaryPassword,
        expiresAt,
      });
      await invitation.save();

      try {
        await transporter.sendMail({
          from: process.env.ZOHO_EMAIL,
          to: email,
          subject: 'HRMS Invitation',
          html: `Welcome to the HRMS! Your temporary password is: <b>${temporaryPassword}</b><br>
                 Accept invitation: <a href="${process.env.FRONTEND_URL}/accept-invitation?token=${token}">Click Here</a><br>
                 Expires on ${moment(expiresAt).format('YYYY-MM-DD')}.`,
        });
      } catch (emailErr) {
        await User.deleteOne({ employeeId: employee._id });
        await Invitation.deleteOne({ employeeId: employee._id });
        throw new Error(`Failed to send invitation email: ${emailErr.message}`);
      }
    }

    // ---------- SUCCESS ----------
    res.status(201).json({ success: true, data: employee });
  } catch (error) {
    console.error('createEmployee - Error:', error);

    // ---------- CLEANUP ----------
    if (employee?._id) {
      await Employee.deleteOne({ _id: employee._id }).catch(() => {});
    }
    for (const path of Object.values(uploadedFiles)) {
      await fs.unlink(path).catch(() => {});
    }

    res.status(400).json({ success: false, error: error.message });
  }
};
// exports.createEmployee = async (req, res) => {
//   let employee = null;
//   let uploadedFiles = {};

//   try {
//     console.log('createEmployee - Request body:', req.body);
//     console.log('createEmployee - Files:', req.files);

//     const {
//       fullName,
//       email,
//       role,
//       companyId,
//       joiningDate,
//       department,
//       designation,
//       createUser = false,
//       createDeviceUser = false
//     } = req.body;

//     if (!fullName || !companyId) {
//       throw new Error('Missing mandatory fields: fullName, companyId');
//     }

//     const company = await Company.findOne({ _id: companyId, isActive: true });
//     if (!company) {
//       throw new Error('Company not found or inactive');
//     }
//     if (!company.employeeIdBase) {
//         throw new Error('Company is not configured for automatic employee ID generation.');
//     }

//     // ID Generation Logic - START NEW
//     const finalRole = req.user.role === 'Super Admin' && role ? role : 'Employee';
//     const basePrefix = company.employeeIdBase.toString();
//     let sequentialNumber;
//     let newEmployeeCode;

//     // Determine the range for sequential numbers based on role
//     let minSequential, maxSequential;
//     if (finalRole === 'C-Level Executive') {
//         minSequential = 1; // e.g., 20001
//         maxSequential = 50; // e.g., 20050
//     } else {
//         minSequential = 51; // e.g., 20051
//         // No explicit max for other roles, will just increment
//     }

//     // Find the last used sequential number for the given prefix and role range
//     const lastEmployee = await Employee.findOne({
//         companyId,
//         newEmployeeCode: new RegExp(`^${basePrefix}\d+`),
//         // Filter by sequential number range if applicable (for C-Level)
//         ...(finalRole === 'C-Level Executive' && {
//             newEmployeeCode: {
//                 $gte: `${basePrefix}${String(minSequential).padStart(2, '0')}`,
//                 $lte: `${basePrefix}${String(maxSequential).padStart(2, '0')}`
//             }
//         })
//     }).sort({ newEmployeeCode: -1 }); // Sort descending to get the highest

//     if (lastEmployee) {
//         const lastSequentialStr = lastEmployee.newEmployeeCode.substring(basePrefix.length);
//         sequentialNumber = parseInt(lastSequentialStr, 10) + 1;
//     } else {
//         sequentialNumber = minSequential;
//     }

//     // Check if sequential number exceeds max for C-Level
//     if (finalRole === 'C-Level Executive' && sequentialNumber > maxSequential) {
//         throw new Error('No available C-Level Executive IDs remaining for this company.');
//     }

//     // Construct the new employee code
//     // Pad sequential number with leading zeros if necessary (e.g., 01, 02 for C-Level)
//     const paddingLength = finalRole === 'C-Level Executive' ? 2 : 2; // Adjust padding as needed
//     newEmployeeCode = `${basePrefix}${String(sequentialNumber).padStart(paddingLength, '0')}`;

//     // Ensure the generated code is unique (fallback for concurrency or gaps)
//     if (await Employee.findOne({ newEmployeeCode })) {
//         throw new Error(`Generated employee code ${newEmployeeCode} already exists. Please try again.`);
//     }
//     // ID Generation Logic - END NEW

//     // OLD ID Generation Logic - COMMENTED OUT
//     /*
//     const finalRole = req.user.role === 'Super Admin' && role ? role : 'Employee';
//     let nextId;

//     if (finalRole === 'C-Level Executive') {
//         const cLevelStart = company.employeeIdBase + 1;
//         const cLevelEnd = company.employeeIdBase + 50;

//         const lastEmployee = await Employee.findOne({ companyId, newEmployeeCode: { $gte: cLevelStart, $lte: cLevelEnd } }).sort({ newEmployeeCode: -1 });
//         nextId = lastEmployee ? parseInt(lastEmployee.newEmployeeCode) + 1 : cLevelStart;

//         if (nextId > cLevelEnd) {
//             throw new Error('No available C-Level Executive IDs remaining for this company.');
//         }
//     } else {
//         const otherStart = company.employeeIdBase + 51;
//         const lastEmployee = await Employee.findOne({ companyId, newEmployeeCode: { $gte: otherStart } }).sort({ newEmployeeCode: -1 });
        
//         // Find the max between the last employee code and the start range, in case the first employee is not C-level
//         const lastNonCLevel = await Employee.findOne({ companyId, newEmployeeCode: { $gte: otherStart } }).sort({ newEmployeeCode: -1 });
//         let lastCode = otherStart -1;
//         if(lastNonCLevel) {
//             lastCode = parseInt(lastNonCLevel.newEmployeeCode)
//         }

//         nextId = Math.max(lastCode + 1, otherStart);
//     }

//     const newEmployeeCode = nextId.toString();

//     if (await Employee.findOne({ newEmployeeCode })) {
//       throw new Error(`Generated employee code ${newEmployeeCode} already exists. Please try again.`);
//     }
//     */
//     // if (createUser && email && await User.findOne({ email })) {
//     //   throw new Error('Email already exists');
//     // }

//     if (email) {
//       const existingEmployee = await Employee.findOne({ email });
//       if (existingEmployee) {
//         throw new Error('Email already in use.');
//       }
//     }
//     // if (req.body.deviceUserId) {
//     //   const existingEmployee = await Employee.findOne({ deviceUserId: req.body.deviceUserId });
//     //   if (existingEmployee) {
//     //     throw new Error('Device User ID already in use.');
//     //   }
//     // }
//     if (req.body.personalPhoneNumber) {
//       const existingEmployee = await Employee.findOne({ personalPhoneNumber: req.body.personalPhoneNumber });
//       if (existingEmployee) {
//         throw new Error('Personal phone number already in use.');
//       }
//     }

//     if (createUser && email && await User.findOne({ email })) {
//       throw new Error('Email already exists');
//     }

//     // Handle file uploads
//     const fileFields = ['passportSizePhoto', 'appointmentLetter', 'resume', 'nidCopy'];
//     for (const field of fileFields) {
//       if (req.files?.[field]) {
//         const file = req.files[field][0];
//         const filePath = file.path.replace(/\\/g, '/'); // Use multer path
//         console.log(`createEmployee - ${field} saved:`, filePath);
//         uploadedFiles[field] = filePath;
//       }
//     }

//     employee = new Employee({
//       fullName,
//       newEmployeeCode,
//       email,
//       role: finalRole,
//       companyId,
//       joiningDate,
//       department,
//       designation,
//       employeeStatus: 'active',
//       passportSizePhoto: uploadedFiles.passportSizePhoto ? `/${uploadedFiles.passportSizePhoto}` : undefined,
//       appointmentLetter: uploadedFiles.appointmentLetter ? `/${uploadedFiles.appointmentLetter}` : undefined,
//       resume: uploadedFiles.resume ? `/${uploadedFiles.resume}` : undefined,
//       nidCopy: uploadedFiles.nidCopy ? `/${uploadedFiles.nidCopy}` : undefined,
//       hasUserAccount: createUser
//     });

//     await employee.save();
//     console.log('createEmployee - Saved employee:', { _id: employee._id });

//     // Create leave entitlement for the new employee
//     if (employee.joiningDate) {
//       try {
//         await leaveController.createLeaveEntitlement(employee._id, employee.joiningDate);
//       } catch (entitlementError) {
//         // If creating entitlement fails, we should probably log it but not fail the whole employee creation
//         console.error(`createEmployee - Failed to create leave entitlement: ${entitlementError.message}`);
//       }
//     }

//     // if (createDeviceUser) {
//     if (createDeviceUser === true || createDeviceUser === 'true') {
//       try {
//         console.log(`createEmployee - check data ${employee.fullName}`);
//         await zkService.setUser(employee.newEmployeeCode, employee.fullName);
//         console.log(`createEmployee - Created device user for ${employee.fullName}`);
//       } catch (zkError) {
//         console.error(`createEmployee - Failed to create device user: ${zkError.message}`);
//         // Decide if you want to throw an error and roll back employee creation
//         // For now, we just log the error and continue
//       }
//     }

//     // if (createUser) {
//     if (createUser === true || createUser === 'true') {
//       if (!email) throw new Error('Email required to create user');
//       const temporaryPassword = crypto.randomBytes(8).toString('hex');
//       const token = crypto.randomBytes(32).toString('hex');
//       const expiresAt = moment().add(7, 'days').toDate();

//       const user = new User({
//         companyId,
//         employeeId: employee._id,
//         email,
//         password: temporaryPassword,
//         role: finalRole,
//         invitationStatus: 'sent'
//       });
//       await user.save();

//       const invitation = new Invitation({
//         companyId,
//         employeeId: employee._id,
//         email,
//         token,
//         temporaryPassword,
//         expiresAt
//       });
//       await invitation.save();

//       try {
//         await transporter.sendMail({
//           from: process.env.ZOHO_EMAIL,
//           to: email,
//           subject: 'HRMS Invitation',
//           html: `Welcome to the HRMS! Your temporary password is: <b>${temporaryPassword}</b><br>\n                 Accept invitation: <a href="${process.env.FRONTEND_URL}/accept-invitation?token=${token}">Click Here</a><br>\n                 Expires on ${moment(expiresAt).format('YYYY-MM-DD')}.`
//         });
//       } catch (emailErr) {
//         await User.deleteOne({ employeeId: employee._id });
//         await Invitation.deleteOne({ employeeId: employee._id });
//         throw new Error(`Failed to send invitation email: ${emailErr.message}`);
//       }
//     }

//     res.status(201).json({ success: true, data: employee });
//   } catch (error) {
//     console.error('createEmployee - Error:', error);
//     if (employee) {
//       await Employee.deleteOne({ _id: employee._id });
//     }
//     for (const filePath of Object.values(uploadedFiles)) {
//       try {
//         await fs.unlink(filePath);
//       } catch (fsErr) {
//         console.error('createEmployee - Cleanup error:', fsErr);
//       }
//     }
//     res.status(400).json({ success: false, error: error.message });
//   }
// };

//// UPDATE EMPLOYEE ///////////////

exports.updateEmployee = async (req, res) => {
  let oldDocuments = {};
  let userCreated = false;
  let uploadedFiles = {};

  try {
    console.log('updateEmployee - Request body:', req.body);
    console.log('updateEmployee - Files:', req.files);

    const { createUser = false, createDeviceUser = false } = req.body;
    const canEditRole = ['Super Admin', 'HR Manager'].includes(req.user.role);

    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      throw new Error('Employee not found');
    }

    if (createUser && employee.hasUserAccount) {
      throw new Error('User already exists for this employee');
    }

    if (req.body.companyId) {
      const company = await Company.findOne({ _id: req.body.companyId, isActive: true });
      if (!company) {
        throw new Error('Company not found or inactive');
      }
    }

    const fileFields = ['passportSizePhoto', 'appointmentLetter', 'resume', 'nidCopy'];
    for (const field of fileFields) {
      if (req.files?.[field]) {
        const file = req.files[field][0];
        const filePath = file.path.replace(/\\/g, '/');
        console.log(`updateEmployee - ${field} saved:`, filePath);
        uploadedFiles[field] = filePath;
      }
    }

    fileFields.forEach(field => {
      if (employee[field]) oldDocuments[field] = employee[field];
    });

    const allowedUpdates = {
      fullName: req.body.fullName,
      email: req.body.email,
      // role: req.user.role === 'Super Admin' ? req.body.role : employee.role,
      role: canEditRole && req.body.role ? req.body.role : employee.role,
      companyId: req.body.companyId,
      joiningDate: req.body.joiningDate,
      department: req.body.department,
      designation: req.body.designation,
      employeeStatus: req.body.employeeStatus,
      managerId: req.body.managerId,
      // deviceUserId: req.body.deviceUserId,
      personalPhoneNumber: req.body.personalPhoneNumber,
      hasIdCard: req.body.hasIdCard,
      presentAddress: req.body.presentAddress,
      gender: req.body.gender,
      dob: req.body.dob,
      passportSizePhoto: uploadedFiles.passportSizePhoto ? `/${uploadedFiles.passportSizePhoto}` : employee.passportSizePhoto,
      appointmentLetter: uploadedFiles.appointmentLetter ? `/${uploadedFiles.appointmentLetter}` : employee.appointmentLetter,
      resume: uploadedFiles.resume ? `/${uploadedFiles.resume}` : employee.resume,
      nidCopy: uploadedFiles.nidCopy ? `/${uploadedFiles.nidCopy}` : employee.nidCopy
    };

    // newEmployeeCode cannot be updated
    delete req.body.newEmployeeCode;

    if (req.body.email) {
      const existingEmployee = await Employee.findOne({ email: req.body.email, _id: { $ne: req.params.id } });
      if (existingEmployee) {
        throw new Error('Email already in use by another employee.');
      }
    }
    // if (req.body.deviceUserId) {
    //   const existingEmployee = await Employee.findOne({ deviceUserId: req.body.deviceUserId, _id: { $ne: req.params.id } });
    //   if (existingEmployee) {
    //     throw new Error('Device User ID already in use by another employee.');
    //   }
    // }
    if (req.body.personalPhoneNumber) {
      const existingEmployee = await Employee.findOne({ personalPhoneNumber: req.body.personalPhoneNumber, _id: { $ne: req.params.id } });
      if (existingEmployee) {
        throw new Error('Personal phone number already in use by another employee.');
      }
    }

    const updates = Object.fromEntries(
      Object.entries(allowedUpdates).filter(([_, value]) => value !== undefined)
    );

    // if (createDeviceUser && !employee.hasUserAccount) {
    if ((createDeviceUser === true || createDeviceUser === 'true') && !employee.hasUserAccount) {
      try {
        await zkService.setUser(employee.newEmployeeCode, employee.fullName);
        console.log(`updateEmployee - Created device user for ${employee.fullName}`);
      } catch (zkError) {
        console.error(`updateEmployee - Failed to create device user: ${zkError.message}`);
        // Decide if you want to throw an error
        // For now, we just log the error and continue
      }
    }

    // 🔹 Create user if requested
    // if (createUser) {
    if (createUser === true || createUser === 'true') {
      if (!req.body.email) throw new Error('Email is required to create a user');
      if (await User.findOne({ email: req.body.email })) {
        throw new Error('Email already exists');
      }

      const temporaryPassword = crypto.randomBytes(8).toString('hex');
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = moment().add(7, 'days').toDate();

      const user = new User({
        companyId: req.body.companyId || employee.companyId,
        employeeId: employee._id,
        email: req.body.email,
        password: temporaryPassword,
        // role: req.user.role === 'Super Admin' ? (req.body.role || employee.role) : 'Employee',
        role: canEditRole && req.body.role ? req.body.role : 'Employee',
        invitationStatus: 'sent'
      });
      await user.save();
      userCreated = true;
      updates.hasUserAccount = true;

      const invitation = new Invitation({
        companyId: req.body.companyId || employee.companyId,
        employeeId: employee._id,
        email: req.body.email,
        token,
        temporaryPassword,
        expiresAt
      });
      await invitation.save();

      try {
        await transporter.sendMail({
          from: process.env.ZOHO_EMAIL,
          to: req.body.email,
          subject: 'HRMS Invitation',
          html: `Welcome to the HRMS! Your temporary password is: <b>${temporaryPassword}</b><br>\n                 Accept invitation: <a href="${process.env.FRONTEND_URL}/accept-invitation?token=${token}">Click Here</a><br>\n                 Expires on ${moment(expiresAt).format('YYYY-MM-DD')}.`
        });
      } catch (emailErr) {
        await User.deleteOne({ employeeId: employee._id });
        await Invitation.deleteOne({ employeeId: employee._id });
        throw new Error('Failed to send invitation email');
      }
    }

    // 🔹 Update Employee
    const updatedEmployee = await Employee.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );
    if (updates.role) {
  const user = await User.findOne({ employeeId: req.params.id });
  if (user) {
    await User.updateOne(
      { employeeId: req.params.id },
      { role: updates.role }
    );
    console.log(`updateEmployee - User role updated for ${user.email}`);
  }
}

    // 🔹 Sync updates to User table if employee already has an account
    if (employee.hasUserAccount) {
      const userUpdates = {};
      if (updates.role) userUpdates.role = updates.role;
      if (updates.email) userUpdates.email = updates.email;

      if (Object.keys(userUpdates).length > 0) {
        await User.updateOne(
          { employeeId: req.params.id },
          { $set: userUpdates }
        );
        console.log(`updateEmployee - Synced User updates:`, userUpdates);
      }
    }

    // 🔹 Delete old files if replaced
    for (const field of fileFields) {
      if (uploadedFiles[field] && oldDocuments[field]) {
        try {
          await fs.unlink(path.join(__dirname, '..', oldDocuments[field]));
          console.log(`updateEmployee - Old ${field} deleted:`, oldDocuments[field]);
        } catch (err) {
          console.error(`updateEmployee - Error deleting old ${field}:`, err);
        }
      }
    }

    res.status(200).json({ success: true, data: updatedEmployee });

  } catch (error) {
    console.error('updateEmployee - Error:', error);

    for (const filePath of Object.values(uploadedFiles)) {
      try {
        await fs.unlink(filePath);
      } catch (fsErr) {
        console.error('updateEmployee - Cleanup error:', fsErr);
      }
    }

    if (userCreated) {
      await User.deleteOne({ employeeId: req.params.id });
      await Invitation.deleteOne({ employeeId: req.params.id });
    }

    res.status(400).json({ success: false, error: error.message });
  }
};

exports.getEmployees = async (req, res) => {
  try {
    let query = {};
    console.log('getEmployees - Query params:', req.query);

    if (req.query.status) {
      if (req.query.status === 'all') {
        query = {};
      } else {
        const statuses = req.query.status.split(',').filter(s => 
          ['active', 'inactive', 'terminated', 'resigned', 'probation'].includes(s)
        );
        query = { employeeStatus: { $in: statuses } };
      }
    }

    if (req.query.department) {
      query.department = req.query.department;
    }

    if (req.query.designation) {
      query.designation = req.query.designation;
    }

    console.log('getEmployees - Query:', query);
    const employees = await Employee.find(query)
      .populate('department')
      .populate('designation')
      .select('-nidPassportNumber');
    console.log('getEmployees - Retrieved employees:', employees.map(e => ({
      _id: e._id,
      fullName: e.fullName,
      passportSizePhoto: e.passportSizePhoto,
      employeeStatus: e.employeeStatus,
      companyId: e.companyId
    })));
    res.status(200).json({ success: true, data: employees });
  } catch (error) {
    console.error('getEmployees - Error:', error);
    res.status(400).json({ success: false, error: error.message });
  } finally {
    console.log('getEmployees - Execution completed');
  }
};

exports.getEmployeeById = async (req, res) => {
  try {
    console.log('getEmployeeById - Fetching employee:', req.params.id);
    const employee = await Employee.findById(req.params.id)
      .populate('department')
      .populate('designation')
      .select('-nidPassportNumber');
    if (!employee) {
      throw new Error('Employee not found');
    }
    console.log('getEmployeeById - Retrieved employee:', {
      _id: employee._id,
      fullName: employee.fullName,
      passportSizePhoto: employee.passportSizePhoto,
      employeeStatus: employee.employeeStatus,
      companyId: employee.companyId
    });
    res.status(200).json({ success: true, data: employee });
  } catch (error) {
    console.error('getEmployeeById - Error:', error);
    res.status(400).json({ success: false, error: error.message });
  } finally {
    console.log('getEmployeeById - Execution completed');
  }
};

exports.getEmployeeDeviceLogs = async (req, res) => {
  try {
    const employee = await Employee.findById(req.query.employeeId).select('deviceUserId');
    if (!employee) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }
    const logs = await Log.find({ user_id: employee.deviceUserId, companyId: req.user.companyId });
    res.status(200).json({ success: true, data: logs });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.getPotentialManagers = async (req, res) => {
  try {
    const { departmentId } = req.params;
    // const potentialManagers = await Employee.find({
    //   department: departmentId,
    //   employeeStatus: 'active'
    // })
    // .select('fullName newEmployeeCode designation role')
    // .populate('designation', 'name');

    const authorizedManagerRoles = ['Manager', 'HR Manager', 'Super Admin', 'Company Admin', 'C-Level Executive'];

    const potentialManagers = await Employee.find({
      department: departmentId,
      employeeStatus: 'active',
      role: { $in: authorizedManagerRoles }
    })
    .select('fullName newEmployeeCode designation role')
    .populate('designation', 'name');
    res.status(200).json({ success: true, data: potentialManagers });
  } catch (error) {
    console.error('getPotentialManagers - Error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
};
