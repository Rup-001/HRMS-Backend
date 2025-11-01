const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const passport = require('../middleware/auth');

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    next();
  };
};

router.get('/', attendanceController.getAttendance);
router.get('/employee-attendance', attendanceController.getEmployeeAttendance );

router.post('/adjustments',
  passport.authenticate('jwt', { session: false }),
  restrictTo('Employee', 'Manager', 'HR Manager', 'Super Admin', 'Company Admin', 'C-Level Executive'), // Employee can create
  attendanceController.createAdjustmentRequest
);

router.patch('/adjustments/:id/manager-review',
  passport.authenticate('jwt', { session: false }),
  restrictTo('Manager', 'HR Manager', 'Super Admin', 'Company Admin', 'C-Level Executive'),
  attendanceController.managerReviewAdjustment
);

router.patch('/adjustments/:id/hr-review',
  passport.authenticate('jwt', { session: false }),
  restrictTo('HR Manager', 'Super Admin', 'Company Admin', 'C-Level Executive'),
  attendanceController.hrReviewAdjustment
);

router.get('/adjustments',
  passport.authenticate('jwt', { session: false }),
  restrictTo('Employee', 'Manager', 'HR Manager', 'Super Admin', 'Company Admin', 'C-Level Executive'),
  attendanceController.getAdjustmentRequests
);

module.exports = router;