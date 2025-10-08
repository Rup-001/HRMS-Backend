// const Employee = require('../models/Employee');
// const User = require('../models/user');
// const Invitation = require('../models/invitation');
// const Company = require('../models/company');
// const nodemailer = require('nodemailer');
// const crypto = require('crypto');
// const moment = require('moment-timezone');
// const fs = require('fs').promises;
// const path = require('path');

// const transporter = nodemailer.createTransport({
//   host: 'smtp.zoho.com',
//   port: 465,
//   secure: true,
//   auth: {
//     user: process.env.ZOHO_EMAIL,
//     pass: process.env.ZOHO_PASSWORD
//   }
// });

// exports.createEmployee = async (req, res) => {
//   let employee = null;
//   let uploadedFiles = {};

//   try {
//     console.log('createEmployee - Request headers:', req.headers);
//     console.log('createEmployee - Content-Type:', req.get('Content-Type'));
//     console.log('createEmployee - Request body:', req.body);
//     console.log('createEmployee - Files:', req.files);

//     const { 
//       fullName, 
//       newEmployeeCode, 
//       email, 
//       role, 
//       companyId, 
//       joiningDate, 
//       assignedDepartment, 
//       designation, 
//       createUser = false 
//     } = req.body;

//     if (!fullName || !newEmployeeCode || !companyId) {
//       throw new Error('Missing mandatory fields: fullName, newEmployeeCode, companyId');
//     }

//     const company = await Company.findOne({ _id: companyId, isActive: true });
//     if (!company) {
//       throw new Error('Company not found or inactive');
//     }

//     if (await Employee.findOne({ newEmployeeCode })) {
//       throw new Error('newEmployeeCode must be unique');
//     }

//     if (createUser && email && await User.findOne({ email })) {
//       throw new Error('Email already exists');
//     }

//     const fileFields = ['passportSizePhoto', 'appointmentLetter', 'resume', 'nidCopy'];
//     for (const field of fileFields) {
//       if (req.files?.[field]) {
//         const file = req.files[field][0];
//         const filePath = path.join('Uploads', `${Date.now()}-${file.originalname}`).replace(/\\/g, '/');
//         await fs.writeFile(path.join(__dirname, '..', filePath), file.buffer);
//         console.log(`createEmployee - ${field} saved:`, filePath);
//         uploadedFiles[field] = filePath;
//       }
//     }

//     const finalRole = req.user.role === 'Super Admin' && role ? role : 'Employee';

//     employee = new Employee({
//       fullName,
//       newEmployeeCode,
//       email,
//       role: finalRole,
//       companyId,
//       joiningDate,
//       assignedDepartment,
//       designation,
//       employeeStatus: 'active',
//       passportSizePhoto: uploadedFiles.passportSizePhoto ? `/${uploadedFiles.passportSizePhoto}` : undefined,
//       appointmentLetter: uploadedFiles.appointmentLetter ? `/${uploadedFiles.appointmentLetter}` : undefined,
//       resume: uploadedFiles.resume ? `/${uploadedFiles.resume}` : undefined,
//       nidCopy: uploadedFiles.nidCopy ? `/${uploadedFiles.nidCopy}` : undefined,
//       hasUserAccount: createUser
//     });

//     await employee.save();
//     console.log('createEmployee - Saved employee:', { _id: employee._id, passportSizePhoto: employee.passportSizePhoto, employeeStatus: employee.employeeStatus });

//     if (createUser) {
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
//           html: `Welcome to the HRMS! Your temporary password is: <b>${temporaryPassword}</b><br>Please accept your invitation and set a new password: <a href="${process.env.FRONTEND_URL}/accept-invitation?token=${token}">Accept Invitation</a><br>This link expires on ${moment(expiresAt).format('YYYY-MM-DD')}.`
//         });
//         console.log('createEmployee - Email sent to:', email);
//       } catch (emailErr) {
//         console.error('createEmployee - Email sending failed:', emailErr.message);
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
//       console.log('createEmployee - Rolled back employee:', employee._id);
//     }
//     for (const [field, filePath] of Object.entries(uploadedFiles)) {
//       try {
//         await fs.unlink(path.join(__dirname, '..', filePath));
//         console.log(`createEmployee - Rolled back ${field}:`, filePath);
//       } catch (fsErr) {
//         console.error(`createEmployee - Error deleting ${field}:`, fsErr);
//       }
//     }
//     res.status(400).json({ success: false, error: error.message });
//   } finally {
//     console.log('createEmployee - Execution completed');
//   }
// };

// exports.updateEmployee = async (req, res) => {
//   let oldDocuments = {};
//   let userCreated = false;
//   let uploadedFiles = {};

//   try {
//     console.log('updateEmployee - Request headers:', req.headers);
//     console.log('updateEmployee - Content-Type:', req.get('Content-Type'));
//     console.log('updateEmployee - Request body:', req.body);
//     console.log('updateEmployee - Files:', req.files);

//     const { createUser = false } = req.body;

//     const employee = await Employee.findById(req.params.id);
//     if (!employee) {
//       throw new Error('Employee not found');
//     }

//     if (createUser && employee.hasUserAccount) {
//       throw new Error('User already exists for this employee');
//     }

//     if (req.body.companyId) {
//       const company = await Company.findOne({ _id: req.body.companyId, isActive: true });
//       if (!company) {
//         throw new Error('Company not found or inactive');
//       }
//     }

//     const fileFields = ['passportSizePhoto', 'appointmentLetter', 'resume', 'nidCopy'];
//     for (const field of fileFields) {
//       if (req.files?.[field]) {
//         const file = req.files[field][0];
//         const filePath = path.join('Uploads', `${Date.now()}-${file.originalname}`).replace(/\\/g, '/');
//         await fs.writeFile(path.join(__dirname, '..', filePath), file.buffer);
//         console.log(`updateEmployee - ${field} saved:`, filePath);
//         uploadedFiles[field] = filePath;
//       }
//     }

//     fileFields.forEach(field => {
//       if (employee[field]) oldDocuments[field] = employee[field];
//     });

//     const allowedUpdates = {
//       fullName: req.body.fullName,
//       email: req.body.email,
//       role: req.user.role === 'Super Admin' ? req.body.role : employee.role,
//       companyId: req.body.companyId,
//       joiningDate: req.body.joiningDate,
//       assignedDepartment: req.body.assignedDepartment,
//       designation: req.body.designation,
//       employeeStatus: req.body.employeeStatus,
//       managerId: req.body.managerId,
//       deviceUserId: req.body.deviceUserId,
//       personalPhoneNumber: req.body.personalPhoneNumber,
//       hasIdCard: req.body.hasIdCard,
//       presentAddress: req.body.presentAddress,
//       gender: req.body.gender,
//       dob: req.body.dob,
//       passportSizePhoto: uploadedFiles.passportSizePhoto ? `/${uploadedFiles.passportSizePhoto}` : employee.passportSizePhoto,
//       appointmentLetter: uploadedFiles.appointmentLetter ? `/${uploadedFiles.appointmentLetter}` : employee.appointmentLetter,
//       resume: uploadedFiles.resume ? `/${uploadedFiles.resume}` : employee.resume,
//       nidCopy: uploadedFiles.nidCopy ? `/${uploadedFiles.nidCopy}` : employee.nidCopy
//     };
//     const updates = Object.fromEntries(
//       Object.entries(allowedUpdates).filter(([_, value]) => value !== undefined)
//     );

//     console.log('updateEmployee - Updates to apply:', updates);

//     if (createUser) {
//       if (!req.body.email) {
//         throw new Error('Email is required to create a user');
//       }
//       if (await User.findOne({ email: req.body.email })) {
//         throw new Error('Email already exists');
//       }

//       const temporaryPassword = crypto.randomBytes(8).toString('hex');
//       const token = crypto.randomBytes(32).toString('hex');
//       const expiresAt = moment().add(7, 'days').toDate();

//       const user = new User({
//         companyId: req.body.companyId || employee.companyId,
//         employeeId: employee._id,
//         email: req.body.email,
//         password: temporaryPassword,
//         role: req.user.role === 'Super Admin' ? (req.body.role || employee.role) : 'Employee',
//         invitationStatus: 'sent'
//       });
//       await user.save();
//       userCreated = true;
//       updates.hasUserAccount = true;

//       const invitation = new Invitation({
//         companyId: req.body.companyId || employee.companyId,
//         employeeId: employee._id,
//         email: req.body.email,
//         token,
//         temporaryPassword,
//         expiresAt
//       });
//       await invitation.save();

//       try {
//         await transporter.sendMail({
//           from: process.env.ZOHO_EMAIL,
//           to: req.body.email,
//           subject: 'HRMS Invitation',
//           html: `Welcome to the HRMS! Your temporary password is: <b>${temporaryPassword}</b><br>Please accept your invitation and set a new password: <a href="${process.env.FRONTEND_URL}/accept-invitation?token=${token}">Accept Invitation</a><br>This link expires on ${moment(expiresAt).format('YYYY-MM-DD')}.`
//         });
//         console.log('updateEmployee - Email sent to:', req.body.email);
//       } catch (emailErr) {
//         console.error('updateEmployee - Email sending failed:', emailErr.message);
//         await User.deleteOne({ employeeId: employee._id });
//         await Invitation.deleteOne({ employeeId: employee._id });
//         throw new Error('Failed to send invitation email');
//       }
//     }

//     const updatedEmployee = await Employee.findByIdAndUpdate(
//       req.params.id,
//       updates,
//       { new: true, runValidators: true }
//     );

//     if (updates.employeeStatus) {
//       await User.findOneAndUpdate(
//         { employeeId: req.params.id },
//         { isActive: updates.employeeStatus === 'active' },
//         { new: true }
//       );
//     }

//     const userUpdates = {};
//     if (req.body.email) userUpdates.email = req.body.email;
//     if (req.body.companyId) userUpdates.companyId = req.body.companyId;
//     if (req.user.role === 'Super Admin' && req.body.role) userUpdates.role = req.body.role;

//     if (Object.keys(userUpdates).length > 0) {
//       await User.findOneAndUpdate(
//         { employeeId: req.params.id },
//         { $set: userUpdates },
//         { new: true }
//       );
//     }

//     for (const field of fileFields) {
//       if (uploadedFiles[field] && oldDocuments[field]) {
//         try {
//           await fs.unlink(path.join(__dirname, '..', oldDocuments[field]));
//           console.log(`updateEmployee - Old ${field} deleted:`, oldDocuments[field]);
//         } catch (err) {
//           console.error(`updateEmployee - Error deleting old ${field}:`, err);
//         }
//       }
//     }

//     console.log('updateEmployee - Updated employee:', updatedEmployee);
//     res.status(200).json({ success: true, data: updatedEmployee });
//   } catch (error) {
//     console.error('updateEmployee - Error:', error);
//     for (const [field, filePath] of Object.entries(uploadedFiles)) {
//       try {
//         await fs.unlink(path.join(__dirname, '..', filePath));
//         console.log(`updateEmployee - Rolled back ${field}:`, filePath);
//       } catch (fsErr) {
//         console.error(`updateEmployee - Error deleting ${field}:`, fsErr);
//       }
//     }
//     if (userCreated) {
//       await User.deleteOne({ employeeId: req.params.id });
//       await Invitation.deleteOne({ employeeId: req.params.id });
//       console.log('updateEmployee - Rolled back user and invitation');
//     }
//     res.status(400).json({ success: false, error: error.message });
//   } finally {
//     console.log('updateEmployee - Execution completed');
//   }
// };





const Employee = require('../models/employee');
const User = require('../models/user');
const Invitation = require('../models/invitation');
const Company = require('../models/company');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const moment = require('moment-timezone');
const fs = require('fs').promises;
const path = require('path');

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

  try {
    console.log('createEmployee - Request body:', req.body);
    console.log('createEmployee - Files:', req.files);

    const {
      fullName,
      newEmployeeCode,
      email,
      role,
      companyId,
      joiningDate,
      assignedDepartment,
      designation,
      createUser = false
    } = req.body;

    if (!fullName || !newEmployeeCode || !companyId) {
      throw new Error('Missing mandatory fields: fullName, newEmployeeCode, companyId');
    }

    const company = await Company.findOne({ _id: companyId, isActive: true });
    if (!company) {
      throw new Error('Company not found or inactive');
    }

    if (await Employee.findOne({ newEmployeeCode })) {
      throw new Error('newEmployeeCode must be unique');
    }

    if (createUser && email && await User.findOne({ email })) {
      throw new Error('Email already exists');
    }

    // Handle file uploads
    const fileFields = ['passportSizePhoto', 'appointmentLetter', 'resume', 'nidCopy'];
    for (const field of fileFields) {
      if (req.files?.[field]) {
        const file = req.files[field][0];
        const filePath = file.path.replace(/\\/g, '/'); // Use multer path
        console.log(`createEmployee - ${field} saved:`, filePath);
        uploadedFiles[field] = filePath;
      }
    }

    const finalRole = req.user.role === 'Super Admin' && role ? role : 'Employee';

    employee = new Employee({
      fullName,
      newEmployeeCode,
      email,
      role: finalRole,
      companyId,
      joiningDate,
      assignedDepartment,
      designation,
      employeeStatus: 'active',
      passportSizePhoto: uploadedFiles.passportSizePhoto ? `/${uploadedFiles.passportSizePhoto}` : undefined,
      appointmentLetter: uploadedFiles.appointmentLetter ? `/${uploadedFiles.appointmentLetter}` : undefined,
      resume: uploadedFiles.resume ? `/${uploadedFiles.resume}` : undefined,
      nidCopy: uploadedFiles.nidCopy ? `/${uploadedFiles.nidCopy}` : undefined,
      hasUserAccount: createUser
    });

    await employee.save();
    console.log('createEmployee - Saved employee:', { _id: employee._id });

    if (createUser) {
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
        invitationStatus: 'sent'
      });
      await user.save();

      const invitation = new Invitation({
        companyId,
        employeeId: employee._id,
        email,
        token,
        temporaryPassword,
        expiresAt
      });
      await invitation.save();

      try {
        await transporter.sendMail({
          from: process.env.ZOHO_EMAIL,
          to: email,
          subject: 'HRMS Invitation',
          html: `Welcome to the HRMS! Your temporary password is: <b>${temporaryPassword}</b><br>
                 Accept invitation: <a href="${process.env.FRONTEND_URL}/accept-invitation?token=${token}">Click Here</a><br>
                 Expires on ${moment(expiresAt).format('YYYY-MM-DD')}.`
        });
      } catch (emailErr) {
        await User.deleteOne({ employeeId: employee._id });
        await Invitation.deleteOne({ employeeId: employee._id });
        throw new Error(`Failed to send invitation email: ${emailErr.message}`);
      }
    }

    res.status(201).json({ success: true, data: employee });
  } catch (error) {
    console.error('createEmployee - Error:', error);
    if (employee) {
      await Employee.deleteOne({ _id: employee._id });
    }
    for (const filePath of Object.values(uploadedFiles)) {
      try {
        await fs.unlink(filePath);
      } catch (fsErr) {
        console.error('createEmployee - Cleanup error:', fsErr);
      }
    }
    res.status(400).json({ success: false, error: error.message });
  }
};

// ================= UPDATE EMPLOYEE =================
// exports.updateEmployee = async (req, res) => {
//   let oldDocuments = {};
//   let userCreated = false;
//   let uploadedFiles = {};

//   try {
//     console.log('updateEmployee - Request body:', req.body);
//     console.log('updateEmployee - Files:', req.files);

//     const { createUser = false } = req.body;

//     const employee = await Employee.findById(req.params.id);
//     if (!employee) {
//       throw new Error('Employee not found');
//     }

//     if (createUser && employee.hasUserAccount) {
//       throw new Error('User already exists for this employee');
//     }

//     if (req.body.companyId) {
//       const company = await Company.findOne({ _id: req.body.companyId, isActive: true });
//       if (!company) {
//         throw new Error('Company not found or inactive');
//       }
//     }

//     const fileFields = ['passportSizePhoto', 'appointmentLetter', 'resume', 'nidCopy'];
//     for (const field of fileFields) {
//       if (req.files?.[field]) {
//         const file = req.files[field][0];
//         const filePath = file.path.replace(/\\/g, '/');
//         console.log(`updateEmployee - ${field} saved:`, filePath);
//         uploadedFiles[field] = filePath;
//       }
//     }

//     fileFields.forEach(field => {
//       if (employee[field]) oldDocuments[field] = employee[field];
//     });

//     const allowedUpdates = {
//       fullName: req.body.fullName,
//       email: req.body.email,
//       role: req.user.role === 'Super Admin' ? req.body.role : employee.role,
//       companyId: req.body.companyId,
//       joiningDate: req.body.joiningDate,
//       assignedDepartment: req.body.assignedDepartment,
//       designation: req.body.designation,
//       employeeStatus: req.body.employeeStatus,
//       managerId: req.body.managerId,
//       deviceUserId: req.body.deviceUserId,
//       personalPhoneNumber: req.body.personalPhoneNumber,
//       hasIdCard: req.body.hasIdCard,
//       presentAddress: req.body.presentAddress,
//       gender: req.body.gender,
//       dob: req.body.dob,
//       passportSizePhoto: uploadedFiles.passportSizePhoto ? `/${uploadedFiles.passportSizePhoto}` : employee.passportSizePhoto,
//       appointmentLetter: uploadedFiles.appointmentLetter ? `/${uploadedFiles.appointmentLetter}` : employee.appointmentLetter,
//       resume: uploadedFiles.resume ? `/${uploadedFiles.resume}` : employee.resume,
//       nidCopy: uploadedFiles.nidCopy ? `/${uploadedFiles.nidCopy}` : employee.nidCopy
//     };

//     const updates = Object.fromEntries(
//       Object.entries(allowedUpdates).filter(([_, value]) => value !== undefined)
//     );

//     if (createUser) {
//       if (!req.body.email) throw new Error('Email is required to create a user');
//       if (await User.findOne({ email: req.body.email })) {
//         throw new Error('Email already exists');
//       }

//       const temporaryPassword = crypto.randomBytes(8).toString('hex');
//       const token = crypto.randomBytes(32).toString('hex');
//       const expiresAt = moment().add(7, 'days').toDate();

//       const user = new User({
//         companyId: req.body.companyId || employee.companyId,
//         employeeId: employee._id,
//         email: req.body.email,
//         password: temporaryPassword,
//         role: req.user.role === 'Super Admin' ? (req.body.role || employee.role) : 'Employee',
//         invitationStatus: 'sent'
//       });
//       await user.save();
//       userCreated = true;
//       updates.hasUserAccount = true;

//       const invitation = new Invitation({
//         companyId: req.body.companyId || employee.companyId,
//         employeeId: employee._id,
//         email: req.body.email,
//         token,
//         temporaryPassword,
//         expiresAt
//       });
//       await invitation.save();

//       try {
//         await transporter.sendMail({
//           from: process.env.ZOHO_EMAIL,
//           to: req.body.email,
//           subject: 'HRMS Invitation',
//           html: `Welcome to the HRMS! Your temporary password is: <b>${temporaryPassword}</b><br>
//                  Accept invitation: <a href="${process.env.FRONTEND_URL}/accept-invitation?token=${token}">Click Here</a><br>
//                  Expires on ${moment(expiresAt).format('YYYY-MM-DD')}.`
//         });
//       } catch (emailErr) {
//         await User.deleteOne({ employeeId: employee._id });
//         await Invitation.deleteOne({ employeeId: employee._id });
//         throw new Error('Failed to send invitation email');
//       }
//     }

//     const updatedEmployee = await Employee.findByIdAndUpdate(
//       req.params.id,
//       updates,
//       { new: true, runValidators: true }
//     );

//     // delete old files if replaced
//     for (const field of fileFields) {
//       if (uploadedFiles[field] && oldDocuments[field]) {
//         try {
//           await fs.unlink(path.join(__dirname, '..', oldDocuments[field]));
//           console.log(`updateEmployee - Old ${field} deleted:`, oldDocuments[field]);
//         } catch (err) {
//           console.error(`updateEmployee - Error deleting old ${field}:`, err);
//         }
//       }
//     }

//     res.status(200).json({ success: true, data: updatedEmployee });
//   } catch (error) {
//     console.error('updateEmployee - Error:', error);
//     for (const filePath of Object.values(uploadedFiles)) {
//       try {
//         await fs.unlink(filePath);
//       } catch (fsErr) {
//         console.error('updateEmployee - Cleanup error:', fsErr);
//       }
//     }
//     if (userCreated) {
//       await User.deleteOne({ employeeId: req.params.id });
//       await Invitation.deleteOne({ employeeId: req.params.id });
//     }
//     res.status(400).json({ success: false, error: error.message });
//   }
// };

exports.updateEmployee = async (req, res) => {
  let oldDocuments = {};
  let userCreated = false;
  let uploadedFiles = {};

  try {
    console.log('updateEmployee - Request body:', req.body);
    console.log('updateEmployee - Files:', req.files);

    const { createUser = false } = req.body;

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
      role: req.user.role === 'Super Admin' ? req.body.role : employee.role,
      companyId: req.body.companyId,
      joiningDate: req.body.joiningDate,
      assignedDepartment: req.body.assignedDepartment,
      designation: req.body.designation,
      employeeStatus: req.body.employeeStatus,
      managerId: req.body.managerId,
      deviceUserId: req.body.deviceUserId,
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

    const updates = Object.fromEntries(
      Object.entries(allowedUpdates).filter(([_, value]) => value !== undefined)
    );

    // 🔹 Create user if requested
    if (createUser) {
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
        role: req.user.role === 'Super Admin' ? (req.body.role || employee.role) : 'Employee',
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

    console.log('getEmployees - Query:', query);
    const employees = await Employee.find(query).select('-nidPassportNumber');
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
    const employee = await Employee.findById(req.params.id).select('-nidPassportNumber');
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
