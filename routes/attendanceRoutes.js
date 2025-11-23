const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { authenticate, restrictTo } = require('../middleware/auth');

router.get('/', attendanceController.getAttendance);
router.get('/employee-attendance', attendanceController.getEmployeeAttendance );

router.post('/adjustments',
  authenticate('jwt', { session: false }),
  restrictTo('Employee', 'Manager', 'HR Manager', 'Super Admin', 'Company Admin', 'C-Level Executive'), // Employee can create
  attendanceController.createAdjustmentRequest
);

router.patch('/adjustments/:id/manager-review',
  authenticate('jwt', { session: false }),
  restrictTo('Manager', 'HR Manager', 'Super Admin', 'Company Admin', 'C-Level Executive'),
  attendanceController.managerReviewAdjustment
);

router.patch('/adjustments/:id/hr-review',
  authenticate('jwt', { session: false }),
  restrictTo('HR Manager', 'Super Admin', 'Company Admin', 'C-Level Executive'),
  attendanceController.hrReviewAdjustment
);

router.get('/adjustments',
  authenticate('jwt', { session: false }),
  restrictTo('Employee', 'Manager', 'HR Manager', 'Super Admin', 'Company Admin', 'C-Level Executive'),
  attendanceController.getAdjustmentRequests
);

module.exports = router;