const express = require('express');
const router = express.Router();
const passport = require('../middleware/auth');
const employeeRoutes = require('./employeeRoutes');
const authRoutes = require('./authRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const attendanceRoutes = require('./attendanceRoutes');
const leaveRoutes = require('./leaveRoutes');
const payslipRoutes = require('./payslipRoutes');
const shiftRoutes = require('./shiftRoutes');
const holidayRoutes = require('./holidayRoutes');
const deviceLogsRoutes = require('./deviceLogsRoutes')
const companyRoutes = require('./companyRoutes')
const documentRoutes = require('./documentRoutes')
const departmentRoutes = require('./departmentRoutes');
const designationRoutes = require('./designationRoutes');

// const leaveEntitlementRoutes = require('./leaveEntitlementRoutes');
// const leavePolicyRoutes = require('./leavePolicyRoutes');

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    if (req.user.role === 'Manager' || req.user.role === 'Employee') {
      if (req.body.companyId && req.body.companyId !== req.user.companyId.toString()) {
        return res.status(403).json({ success: false, error: 'Company access denied' });
      }
    }
    next();
  };
};

router.use('/employees', employeeRoutes);
router.use('/auth', authRoutes);
router.use('/deviceLogs', deviceLogsRoutes);
router.use('/dashboard',  dashboardRoutes);
router.use('/attendance', passport.authenticate('jwt', { session: false }), attendanceRoutes);
router.use('/leave', passport.authenticate('jwt', { session: false }), leaveRoutes);
router.use('/payslips', payslipRoutes);
router.use('/shifts', shiftRoutes);
router.use('/holidays', passport.authenticate('jwt', { session: false }), holidayRoutes);
router.use('/company', passport.authenticate('jwt', { session: false }), companyRoutes);
router.use('/document', passport.authenticate('jwt', { session: false }), documentRoutes);
router.use('/departments', passport.authenticate('jwt', { session: false }), departmentRoutes);
router.use('/designations', passport.authenticate('jwt', { session: false }), designationRoutes);

// router.use('/leave-entitlement', passport.authenticate('jwt', { session: false }), leaveEntitlementRoutes);
// router.use('/leave-policy', passport.authenticate('jwt', { session: false }), leavePolicyRoutes);

router.get('/', (req, res) => res.json({ message: 'HRMS API Running' }));

module.exports = router;