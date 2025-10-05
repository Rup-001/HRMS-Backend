const User = require('../models/user');
const Invitation = require('../models/invitation');
const jwt = require('jsonwebtoken');

const moment = require('moment-timezone');

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !await user.comparePassword(password)) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    if (!user.isActive) {
      return res.status(403).json({ success: false, error: 'Account inactive' });
    }
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role, employeeId: user.employeeId, companyId: user.companyId },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.status(200).json({ success: true, token, user  });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.acceptInvitation = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const invitation = await Invitation.findOne({ token, accepted: false });
    if (!invitation || moment().isAfter(invitation.expiresAt)) {
      return res.status(400).json({ success: false, error: 'Invalid or expired invitation' });
    }
    const user = await User.findOne({ email: invitation.email, employeeId: invitation.employeeId });
    if (!user) {
      return res.status(400).json({ success: false, error: 'User not found' });
    }
    user.password = newPassword;
    user.isActive = true;
    await user.save();
    invitation.accepted = true;
    await invitation.save();
    const tokenJwt = jwt.sign(
      { id: user._id, email: user.email, role: user.role, employeeId: user.employeeId, companyId: user.companyId },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    res.status(200).json({ success: true, token: tokenJwt });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    if (!await user.comparePassword(oldPassword)) {
      return res.status(401).json({ success: false, error: 'Invalid old password' });
    }
    user.password = newPassword;
    await user.save();
    res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.log("error", error)
    res.status(400).json({ success: false, error: error.message });
  }
};