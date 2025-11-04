const User = require('../models/user');
const Invitation = require('../models/invitation');
const PasswordReset = require('../models/passwordReset');
const Employee = require('../models/employee');
const Company = require('../models/company');
const LeavePolicy = require('../models/leavePolicy');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const moment = require('moment-timezone');
const crypto = require('crypto');

const transporter = nodemailer.createTransport({
  host: 'smtp.zoho.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.ZOHO_EMAIL,
    pass: process.env.ZOHO_PASSWORD
  }
});

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('login - Request body:', { email });
    const user = await User.findOne({ email }).select('+password');
    if (!user || !await user.comparePassword(password)) {
      console.log('login - Invalid credentials for email:', email);
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    if (!user.isActive) {
      console.log('login - Account inactive for user:', user._id);
      return res.status(403).json({ success: false, error: 'Account inactive' });
    }
    const employee = await Employee.findOne({ _id: user.employeeId, employeeStatus: 'active' });
    if (!employee) {
      console.log('login - Employee not active for user:', user._id);
      return res.status(403).json({ success: false, error: 'Employee account not active' });
    }
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role, employeeId: user.employeeId, companyId: user.companyId , passportSizePhoto: user.passportSizePhoto },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '24h' }
    );
    console.log('login - Token generated for user:', user._id);
    res.status(200).json({ success: true, token, user: { id: user._id, email: user.email, role: user.role, employeeId: user.employeeId, companyId: user.companyId } });
  } catch (error) {
    console.error('login - Error:', error);
    res.status(400).json({ success: false, error: error.message });
  } finally {
    console.log('login - Execution completed');
  }
};

exports.acceptInvitation = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    console.log('acceptInvitation - Request body:', { token });
    const invitation = await Invitation.findOne({ token, accepted: false });
    if (!invitation || moment().isAfter(invitation.expiresAt)) {
      console.log('acceptInvitation - Invalid or expired invitation:', token);
      await User.findOneAndUpdate(
        { email: invitation?.email, employeeId: invitation?.employeeId },
        { invitationStatus: 'expired' }
      );
      return res.status(400).json({ success: false, error: 'Invalid or expired invitation' });
    }
    const user = await User.findOne({ email: invitation.email, employeeId: invitation.employeeId });
    if (!user) {
      console.log('acceptInvitation - User not found for email:', invitation.email);
      return res.status(400).json({ success: false, error: 'User not found' });
    }
    user.password = newPassword;
    user.isActive = true;
    user.invitationStatus = 'accepted';
    user.invitationExpires = null;
    await user.save();
    invitation.accepted = true;
    await invitation.save();
    console.log('acceptInvitation - User updated:', user._id);
    const tokenJwt = jwt.sign(
      { id: user._id, email: user.email, role: user.role, employeeId: user.employeeId, companyId: user.companyId },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '1h' }
    );
    res.status(200).json({ success: true, token: tokenJwt });
  } catch (error) {
    console.error('acceptInvitation - Error:', error);
    res.status(400).json({ success: false, error: error.message });
  } finally {
    console.log('acceptInvitation - Execution completed');
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    console.log('changePassword - Request body:', { userId: req.user._id });
    const user = await User.findById(req.user._id).select('+password');
    if (!user || !await user.comparePassword(oldPassword)) {
      console.log('changePassword - Invalid old password for user:', req.user._id);
      return res.status(401).json({ success: false, error: 'Invalid old password' });
    }
    user.password = newPassword;
    await user.save();
    console.log('changePassword - Password changed for user:', user._id);
    res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('changePassword - Error:', error);
    res.status(400).json({ success: false, error: error.message });
  } finally {
    console.log('changePassword - Execution completed');
  }
};

exports.requestPasswordReset = async (req, res) => {
  try {
    console.log('requestPasswordReset - User role:', req.user.role);
    if (req.user.role !== 'Super Admin') {
      console.log('requestPasswordReset - Access denied for user:', req.user._id);
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    const user = await User.findById(req.params.userId);
    if (!user) {
      console.log('requestPasswordReset - User not found:', req.params.userId);
      return res.status(400).json({ success: false, error: 'User not found' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = moment().add(1, 'hour').toDate();

    const passwordReset = new PasswordReset({
      userId: user._id,
      token,
      expiresAt
    });
    await passwordReset.save();
    console.log('requestPasswordReset - Password reset token created for user:', user._id);

    try {
      await transporter.sendMail({
        from: process.env.ZOHO_EMAIL,
        to: user.email,
        subject: 'HRMS Password Reset',
        html: `You have requested a password reset. Please reset your password: <a href="${process.env.FRONTEND_URL}/reset-password?token=${token}">Reset Password</a><br>This link expires in 1 hour.`
      });
      console.log('requestPasswordReset - Email sent to:', user.email);
      res.status(200).json({ success: true, message: 'Password reset link sent' });
    } catch (emailErr) {
      console.error('requestPasswordReset - Email sending failed:', emailErr.message);
      await PasswordReset.deleteOne({ userId: user._id, token });
      throw new Error('Failed to send password reset email');
    }
  } catch (error) {
    console.error('requestPasswordReset - Error:', error);
    res.status(400).json({ success: false, error: error.message });
  } finally {
    console.log('requestPasswordReset - Execution completed');
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    console.log('resetPassword - Request body:', { token });
    const passwordReset = await PasswordReset.findOne({ token, used: false });
    if (!passwordReset || moment().isAfter(passwordReset.expiresAt)) {
      console.log('resetPassword - Invalid or expired token:', token);
      return res.status(400).json({ success: false, error: 'Invalid or expired reset token' });
    }
    const user = await User.findById(passwordReset.userId).select('+password');
    if (!user) {
      console.log('resetPassword - User not found for token:', token);
      return res.status(400).json({ success: false, error: 'User not found' });
    }
    user.password = newPassword;
    user.isActive = true;
    await user.save();
    passwordReset.used = true;
    await passwordReset.save();
    console.log('resetPassword - Password reset for user:', user._id);
    res.status(200).json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('resetPassword - Error:', error);
    res.status(400).json({ success: false, error: error.message });
  } finally {
    console.log('resetPassword - Execution completed');
  }
};

exports.resendInvitation = async (req, res) => {
  try {
    const { email } = req.body;
    console.log('resendInvitation - Request body:', { email });

    const user = await User.findOne({ email });
    if (!user) {
      console.log('resendInvitation - User not found for email:', email);
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const temporaryPassword = crypto.randomBytes(8).toString('hex');
    const invitationToken = crypto.randomBytes(32).toString('hex');
    const invitationExpires = moment().add(3, 'days').toDate();

    const invitation = new Invitation({
      companyId: user.companyId,
      email: user.email,
      employeeId: user.employeeId,
      token: invitationToken,
      temporaryPassword,
      expiresAt: invitationExpires,
    });
    await invitation.save();

    user.password = temporaryPassword;
    user.invitationStatus = 'sent';
    user.invitationExpires = invitationExpires;
    await user.save();

    const invitationLink = `${process.env.FRONTEND_URL}/accept-invitation?token=${invitationToken}`;
    
    await transporter.sendMail({
      from: process.env.ZOHO_EMAIL,
      to: user.email,
      subject: 'HRMS Invitation',
      html: `Welcome to the HRMS! Your temporary password is: <b>${temporaryPassword}</b><br>
             Accept invitation: <a href="${invitationLink}">Click Here</a><br>
             Expires on ${moment(invitationExpires).format('YYYY-MM-DD')}.`
    });

    console.log('resendInvitation - Invitation resent to:', user.email);
    res.status(200).json({ success: true, message: 'Invitation resent successfully' });
  } catch (error) {
    console.error('resendInvitation - Error:', error);
    res.status(400).json({ success: false, error: error.message });
  } finally {
    console.log('resendInvitation - Execution completed');
  }
};

// ================= INITIAL SETUP (FIRST SUPER ADMIN) =================
exports.initialSetup = async (req, res) => {
  try {
    // 1. Check if any users already exist
    const existingUser = await User.findOne();
    if (existingUser) {
      return res.status(403).json({ success: false, error: 'Initial setup already completed. Users exist.' });
    }

    const { fullName, email, password /*, companyName*/ } = req.body;
    if (!fullName || !email || !password /*|| !companyName*/) {
      return res.status(400).json({ success: false, error: 'Missing required fields: fullName, email, password /*, companyName*/' });
    }

    // 2. Create the first company
    // let company = await Company.findOne({ name: companyName });
    // if (!company) {
    //   company = new Company({ name: companyName, employeeIdBase: 1000 }); // Default base for employee IDs
    //   await company.save();
    //   console.log('initialSetup - Created initial company:', company.name);
    // }

    // 3. Create a default leave policy for the new company
    // let leavePolicy = await LeavePolicy.findOne({ companyId: company._id });
    // if (!leavePolicy) {
    //   leavePolicy = new LeavePolicy({ companyId: company._id });
    //   await leavePolicy.save();
    //   console.log('initialSetup - Created default leave policy for company:', company.name);
    // }

    // 4. Create the first employee (Super Admin)
    // const newEmployeeCode = (company.employeeIdBase + 1).toString(); // First employee gets base + 1
    const employee = new Employee({
      fullName,
      email,
      // newEmployeeCode,
      // companyId: company._id,
      role: 'Super Admin',
      employeeStatus: 'active',
      joiningDate: new Date(),
      hasUserAccount: true
    });
    await employee.save();
    console.log('initialSetup - Created initial Super Admin employee:', employee.fullName);

    // 5. Create the first user (Super Admin)
    const user = new User({
      employeeId: employee._id,
      // companyId: company._id,
      email,
      password,
      role: 'Super Admin',
      isActive: true,
      invitationStatus: 'accepted'
    });
    await user.save();
    console.log('initialSetup - Created initial Super Admin user:', user.email);

    // 6. Generate token for the new Super Admin
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role, employeeId: user.employeeId /*, companyId: user.companyId*/ },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '24h' }
    );

    res.status(201).json({ success: true, message: 'Initial setup complete. Super Admin created.', token });
  } catch (error) {
    console.error('initialSetup - Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};