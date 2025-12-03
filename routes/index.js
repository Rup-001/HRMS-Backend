const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
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

router.use('/employees', employeeRoutes);
router.use('/auth', authRoutes);
router.use('/deviceLogs', deviceLogsRoutes);
router.use('/dashboard',  dashboardRoutes);
router.use('/attendance', authenticate('jwt', { session: false }), attendanceRoutes);
router.use('/leave', authenticate('jwt', { session: false }), leaveRoutes);
router.use('/payslips', payslipRoutes);
router.use('/shifts', shiftRoutes);
router.use('/holidays', authenticate('jwt', { session: false }), holidayRoutes);
router.use('/company', authenticate('jwt', { session: false }), companyRoutes);
router.use('/documents', authenticate('jwt', { session: false }), documentRoutes);
router.use('/departments', authenticate('jwt', { session: false }), departmentRoutes);
router.use('/designations', authenticate('jwt', { session: false }), designationRoutes);

// router.use('/leave-entitlement', passport.authenticate('jwt', { session: false }), leaveEntitlementRoutes);
// router.use('/leave-policy', passport.authenticate('jwt', { session: false }), leavePolicyRoutes);

router.get('/', (req, res) => res.json({ message: 'HRMS API Running' }));

module.exports = router;