const Employee = require('../models/employee');
const User = require('../models/user');
const Invitation = require('../models/invitation');
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

  const maxAttempts = 5;
  let attempt = 0;
  let newEmployeeCode = null; // ← DECLARED OUTSIDE LOOP

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

    // ---------- RETRY LOOP ----------
    while (attempt < maxAttempts) {
      attempt++;

      try {
        let minSeq, maxSeq;
        if (finalRole === 'C-Level Executive') {
          minSeq = 1;
          maxSeq = 50;
        } else {
          minSeq = 51;
          maxSeq = null;
        }

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

        let sequentialNumber = lastEmployee
          ? parseInt(lastEmployee.newEmployeeCode.substring(basePrefix.length), 10) + 1
          : minSeq;

        if (finalRole === 'C-Level Executive' && sequentialNumber > maxSeq) {
          throw new Error('No available C-Level Executive IDs remaining for this company.');
        }

        newEmployeeCode = `${basePrefix}${String(sequentialNumber).padStart(2, '0')}`;

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
          hasUserAccount: createUser === true || createUser === 'true',
        });

        await employee.save();
        console.log('Employee saved with code:', newEmployeeCode);
        break;

      } catch (saveErr) {
        if (
          saveErr.name === 'MongoServerError' &&
          saveErr.code === 11000 &&
          saveErr.message.includes('newEmployeeCode')
        ) {
          console.warn(`Duplicate employee code on attempt ${attempt}. Retrying...`);
          continue;
        }
        throw saveErr;
      }
    }

    if (attempt >= maxAttempts) {
      throw new Error('Failed to generate a unique employee code after several attempts.');
    }

    // ---------- LEAVE ENTITLEMENT ----------
    if (employee.joiningDate) {
      try {
        await leaveController.createLeaveEntitlement(employee._id, employee.joiningDate);
        console.log(`Created leave entitlement for employee: ${employee._id}`);
      } catch (e) {
        console.error('Leave entitlement error (non-fatal):', e.message);
      }
    }

    // ---------- DEVICE USER: STRICT VALIDATION ----------
    if (createDeviceUser === true || createDeviceUser === 'true') {
      const existsOnDevice = await zkService.checkUserExistsOnDevice(newEmployeeCode);
      if (existsOnDevice) {
        throw new Error(
          `Device User ID ${newEmployeeCode} already exists on ZK device. Delete old user first.`
        );
      }

      let deviceResult;
      try {
        deviceResult = await zkService.setUser(newEmployeeCode, fullName);
        if (!deviceResult.success) {
          throw new Error('ZK device rejected user creation');
        }
      } catch (deviceError) {
        console.error('ZK Device creation failed:', deviceError.message);
        throw new Error(
          `Failed to create user on ZK device: ${deviceError.message}. Employee creation aborted.`
        );
      }

      employee.deviceUserId = newEmployeeCode;
      await employee.save();
      console.log(`Device user created: ${newEmployeeCode}`);
    }

    // ---------- USER ACCOUNT ----------
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

      employee.hasUserAccount = true;
      await employee.save();
    }

    res.status(201).json({ success: true, data: employee });

  } catch (error) {
    console.error('createEmployee - Error:', error);

    // ---------- CLEANUP ----------
    if (employee?._id) {
      await Employee.deleteOne({ _id: employee._id }).catch(() => {});
    }
    for (const filePath of Object.values(uploadedFiles)) {
      await fs.unlink(filePath).catch(() => {});
    }

    res.status(400).json({ success: false, error: error.message });
  }
};

// ================================================
// UPDATE EMPLOYEE
// ================================================

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
    if (!employee) throw new Error('Employee not found');

    if (createUser && employee.hasUserAccount) {
      throw new Error('User already exists for this employee');
    }

    if (req.body.companyId) {
      const company = await Company.findOne({ _id: req.body.companyId, isActive: true });
      if (!company) throw new Error('Company not found or inactive');
    }

    const fileFields = ['passportSizePhoto', 'appointmentLetter', 'resume', 'nidCopy'];
    for (const field of fileFields) {
      if (req.files?.[field]) {
        const file = req.files[field][0];
        const filePath = file.path.replace(/\\/g, '/');
        uploadedFiles[field] = filePath;
      }
    }

    fileFields.forEach(field => {
      if (employee[field]) oldDocuments[field] = employee[field];
    });

    const allowedUpdates = {
      fullName: req.body.fullName,
      email: req.body.email,
      role: canEditRole && req.body.role ? req.body.role : employee.role,
      companyId: req.body.companyId,
      joiningDate: req.body.joiningDate,
      department: req.body.department,
      designation: req.body.designation,
      employeeStatus: req.body.employeeStatus,
      managerId: req.body.managerId,
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

    delete req.body.newEmployeeCode;

    if (req.body.email) {
      const existing = await Employee.findOne({ email: req.body.email, _id: { $ne: req.params.id } });
      if (existing) throw new Error('Email already in use by another employee.');
    }
    if (req.body.personalPhoneNumber) {
      const existing = await Employee.findOne({ personalPhoneNumber: req.body.personalPhoneNumber, _id: { $ne: req.params.id } });
      if (existing) throw new Error('Personal phone number already in use by another employee.');
    }

    const updates = Object.fromEntries(
      Object.entries(allowedUpdates).filter(([_, v]) => v !== undefined)
    );

    // ---------- DEVICE USER: STRICT ----------
    if ((createDeviceUser === true || createDeviceUser === 'true') && !employee.deviceUserId) {
      const existsOnDevice = await zkService.checkUserExistsOnDevice(employee.newEmployeeCode);
      if (existsOnDevice) {
        throw new Error(`Device User ID ${employee.newEmployeeCode} already exists on ZK device.`);
      }

      let deviceResult;
      try {
        deviceResult = await zkService.setUser(employee.newEmployeeCode, employee.fullName);
        if (!deviceResult.success) throw new Error('ZK device rejected user creation');
      } catch (deviceError) {
        throw new Error(`Failed to create user on ZK device: ${deviceError.message}`);
      }

      employee.deviceUserId = employee.newEmployeeCode;
      await employee.save();
    }

    // ---------- USER ACCOUNT ----------
    if (createUser === true || createUser === 'true') {
      if (!req.body.email) throw new Error('Email is required to create a user');
      if (await User.findOne({ email: req.body.email })) throw new Error('Email already exists');

      const temporaryPassword = crypto.randomBytes(8).toString('hex');
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = moment().add(7, 'days').toDate();

      const user = new User({
        companyId: req.body.companyId || employee.companyId,
        employeeId: employee._id,
        email: req.body.email,
        password: temporaryPassword,
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
          html: `Welcome to the HRMS! Your temporary password is: <b>${temporaryPassword}</b><br>
                 Accept invitation: <a href="${process.env.FRONTEND_URL}/accept-invitation?token=${token}">Click Here</a><br>
                 Expires on ${moment(expiresAt).format('YYYY-MM-DD')}.`
        });
      } catch (emailErr) {
        await User.deleteOne({ employeeId: employee._id });
        await Invitation.deleteOne({ employeeId: employee._id });
        throw new Error('Failed to send invitation email');
      }
    }

    // ---------- UPDATE EMPLOYEE ----------
    const updatedEmployee = await Employee.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (updates.role) {
      const user = await User.findOne({ employeeId: req.params.id });
      if (user) {
        await User.updateOne({ employeeId: req.params.id }, { role: updates.role });
      }
    }

    if (employee.hasUserAccount) {
      const userUpdates = {};
      if (updates.role) userUpdates.role = updates.role;
      if (updates.email) userUpdates.email = updates.email;
      if (Object.keys(userUpdates).length > 0) {
        await User.updateOne({ employeeId: req.params.id }, { $set: userUpdates });
      }
    }

    // ---------- DELETE OLD FILES ----------
    // for (const field of fileFields) {
    //   if (uploadedFiles[field] && oldDocuments[field]) {
    //     try {
    //       await fs.unlink(path.join(__dirname, '..', oldDocuments[field]));
    //     } catch (err) {
    //       console.error(`Error deleting old ${field}:`, err);
    //     }
    //   }
    // }

    res.status(200).json({ success: true, data: updatedEmployee });

  } catch (error) {
    console.error('updateEmployee - Error:', error);

    for (const filePath of Object.values(uploadedFiles)) {
      await fs.unlink(filePath).catch(() => {});
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
    const employees = await Employee.aggregate([
      { $match: query },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: 'employeeId',
          as: 'user'
        }
      },
      {
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          fullName: 1,
          newEmployeeCode: 1,
          email: 1,
          role: 1,
          companyId: 1,
          joiningDate: 1,
          department: 1,
          designation: 1,
          employeeStatus: 1,
          passportSizePhoto: 1,
          appointmentLetter: 1,
          resume: 1,
          nidCopy: 1,
          hasUserAccount: 1,
          invitationStatus: '$user.invitationStatus'
        }
      },
      {
        $lookup: {
          from: 'departments',
          localField: 'department',
          foreignField: '_id',
          as: 'department'
        }
      },
      {
        $unwind: {
          path: '$department',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: 'designations',
          localField: 'designation',
          foreignField: '_id',
          as: 'designation'
        }
      },
      {
        $unwind: {
          path: '$designation',
          preserveNullAndEmptyArrays: true
        }
      }
    ]);
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
