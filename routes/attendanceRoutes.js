const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');

router.get('/', attendanceController.getAttendance);
router.get('/employee-attendance', attendanceController.getEmployeeAttendance );

module.exports = router;