const express = require('express');
const router = express.Router();
const leaveController = require('../controllers/leaveController');

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    next();
  };
};

router.post('/',  leaveController.createLeaveRequest);
router.post('/:id/approve', restrictTo('Manager', 'HR Manager', 'Super Admin', 'Company Admin'), leaveController.approveLeaveRequest);
router.post('/:id/deny', restrictTo('Manager', 'HR Manager', 'Super Admin', 'Company Admin'), leaveController.denyLeaveRequest);
router.get('/', leaveController.getLeaveRequests);

module.exports = router;