const express = require('express');
const router = express.Router();
const passport = require('../middleware/auth');
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
router.post('/:id/approve', restrictTo('Manager', 'HR Manager', 'Super Admin', 'Company Admin', 'C-Level Executive'), leaveController.approveLeaveRequest);
router.post('/:id/deny', restrictTo('Manager', 'HR Manager', 'Super Admin', 'Company Admin' , 'C-Level Executive'), leaveController.denyLeaveRequest);
router.get('/', leaveController.getLeaveRequests);
router.get('/summary', passport.authenticate('jwt', { session: false }), leaveController.getLeaveSummary);

// Leave Entitlement Routes
router.get('/entitlement/:employeeId', 
  passport.authenticate('jwt', { session: false }),
  restrictTo('HR Manager', 'Super Admin', 'Company Admin', 'C-Level Executive', 'Employee'),
  leaveController.getLeaveEntitlement
);

router.patch('/entitlement/:employeeId', 
  passport.authenticate('jwt', { session: false }),
  restrictTo('HR Manager', 'Super Admin', 'Company Admin'),
  leaveController.updateLeaveEntitlement
);

// Leave Policy Routes
router.get('/policy', 
  passport.authenticate('jwt', { session: false }),
  restrictTo('HR Manager', 'Super Admin', 'Company Admin', 'C-Level Executive'),
  leaveController.getLeavePolicy
);

router.patch('/policy', 
  passport.authenticate('jwt', { session: false }),
  restrictTo('HR Manager', 'Super Admin', 'Company Admin'),
  leaveController.updateLeavePolicy
);

// Generate Missing Leave Entitlements Route
router.post('/generate-entitlements',
  passport.authenticate('jwt', { session: false }),
  restrictTo('Super Admin', 'Company Admin'),
  leaveController.generateMissingLeaveEntitlements
);

module.exports = router;