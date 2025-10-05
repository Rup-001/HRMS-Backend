const Employee = require('../models/employee');
const User = require('../models/user');
const Invitation = require('../models/invitation');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const moment = require('moment-timezone');

const transporter = nodemailer.createTransport({
  host: 'smtp.zoho.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.ZOHO_EMAIL,
    pass: process.env.ZOHO_PASSWORD
  }
});

exports.createEmployee = async (req, res) => {
  try {
    const { fullName, newEmployeeCode, email, role, companyId, joiningDate, assignedDepartment, designation } = req.body;
    if (!fullName || !newEmployeeCode || !email || !role || !companyId || !joiningDate || !assignedDepartment || !designation) {
      return res.status(400).json({ success: false, error: 'Missing mandatory fields' });
    }

    if (await Employee.findOne({ newEmployeeCode })) {
      return res.status(400).json({ success: false, error: 'newEmployeeCode must be unique' });
    }
    if (await User.findOne({ email })) {
      return res.status(400).json({ success: false, error: 'Email already exists' });
    }

    const employee = new Employee({ ...req.body, employeeStatus: 'active' });
    await employee.save();

    const temporaryPassword = crypto.randomBytes(8).toString('hex');
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = moment().add(7, 'days').toDate();

    const user = new User({
      companyId,
      employeeId: employee._id,
      email,
      password: temporaryPassword,
      role
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

    const invitationUrl = `${process.env.FRONTEND_URL}/accept-invitation?token=${token}`;
    await transporter.sendMail({
      from: process.env.ZOHO_EMAIL,
      to: email,
      subject: 'HRMS Invitation',
      html: `Welcome to the HRMS! Your temporary password is: <b>${temporaryPassword}</b><br>Please accept your invitation and set a new password: <a href="${invitationUrl}">Accept Invitation</a><br>This link expires on ${moment(expiresAt).format('YYYY-MM-DD')}.`
    });

    res.status(201).json({ success: true, data: employee });
  } catch (error) {
    console.log("error", error)
    res.status(400).json({ success: false, error: error.message });
  }
};

// exports.updateEmployee = async (req, res) => {
//   try {
//     const employee = await Employee.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
//     if (!employee) {
//       return res.status(404).json({ success: false, error: 'Employee not found' });
//     }
//     res.status(200).json({ success: true, data: employee });
//   } catch (error) {
//     res.status(400).json({ success: false, error: error.message });
//   }
// };

exports.updateEmployee = async (req, res) => {
  try {
    // 1️⃣ Update Employee
    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!employee) {
      return res.status(404).json({ success: false, error: "Employee not found" });
    }

    // 2️⃣ Sync to User model
    const userUpdates = {};

    if (req.body.email) userUpdates.email = req.body.email;
    if (req.body.companyId) userUpdates.companyId = req.body.companyId;
    if (req.body.role) userUpdates.role = req.body.role; // ✅ update role too

    if (Object.keys(userUpdates).length > 0) {
      await User.findOneAndUpdate(
        { employeeId: req.params.id },
        { $set: userUpdates },
        { new: true }
      );
    }

    // 3️⃣ Send response
    res.status(200).json({ success: true, data: employee });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.getEmployees = async (req, res) => {
  try {
    const query = req.user.role === 'Employee' || req.user.role === 'Manager' ? { companyId: req.user.companyId } : {};
    const employees = await Employee.find(query).select('-nidPassportNumber');
    res.status(200).json({ success: true, data: employees });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.getEmployeeById = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id).select('-nidPassportNumber');
    if (!employee) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }
    if (req.user.role === 'Employee' && req.user.employeeId.toString() !== req.params.id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    if ((req.user.role === 'Employee' || req.user.role === 'Manager') && employee.companyId.toString() !== req.user.companyId.toString()) {
      return res.status(403).json({ success: false, error: 'Company access denied' });
    }
    res.status(200).json({ success: true, data: employee });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findByIdAndDelete(req.params.id);
    if (!employee) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }
    await User.findOneAndDelete({ employeeId: req.params.id });
    res.status(200).json({ success: true, message: 'Employee deleted' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
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


