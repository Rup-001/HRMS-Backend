const express = require('express');
const router = express.Router();
const { authenticate, restrictTo } = require('../middleware/auth');
const leaveController = require('../controllers/leaveController');

router.post('/',  leaveController.createLeaveRequest);
router.post('/:id/approve', restrictTo('Manager', 'HR Manager', 'Super Admin', 'Company Admin', 'C-Level Executive'), leaveController.approveLeaveRequest);
router.post('/:id/deny', restrictTo('Manager', 'HR Manager', 'Super Admin', 'Company Admin' , 'C-Level Executive'), leaveController.denyLeaveRequest);
router.get('/', leaveController.getLeaveRequests);
router.get('/summary', authenticate('jwt', { session: false }), leaveController.getLeaveSummary);

// Leave Entitlement Routes
router.get('/entitlement/:employeeId', 
  authenticate('jwt', { session: false }),
  restrictTo('HR Manager', 'Super Admin', 'Company Admin', 'C-Level Executive', 'Employee'),
  leaveController.getLeaveEntitlement
);

router.patch('/entitlement/:employeeId', 
  authenticate('jwt', { session: false }),
  restrictTo('HR Manager', 'Super Admin', 'Company Admin'),
  leaveController.updateLeaveEntitlement
);

// Leave Policy Routes
router.get('/policy', 
  authenticate('jwt', { session: false }),
  restrictTo('HR Manager', 'Super Admin', 'Company Admin', 'C-Level Executive'),
  leaveController.getLeavePolicy
);

router.patch('/policy/:companyId', 
  authenticate('jwt', { session: false }),
  restrictTo('HR Manager', 'Super Admin', 'Company Admin'),
  leaveController.updateLeavePolicy
);

// Generate Missing Leave Entitlements Route
router.post('/generate-entitlements',
  authenticate('jwt', { session: false }),
  restrictTo('Super Admin', 'Company Admin', 'HR Manager'),
  leaveController.generateMissingLeaveEntitlements
);

router.post('/encash-annual-leave',
  authenticate('jwt', { session: false }),
  restrictTo('Employee', 'Manager', 'HR Manager', 'Super Admin', 'Company Admin', 'C-Level Executive'),
  leaveController.encashAnnualLeave
);

module.exports = router;