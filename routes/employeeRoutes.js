// const express = require('express');
// const router = express.Router();
// const employeeController = require('../controllers/employeeController');

// // CRUD routes
// router.post('/', employeeController.createEmployee);
// router.patch('/:id', employeeController.updateEmployee);
// router.get('/', employeeController.getEmployees);
// router.get('/:id', employeeController.getEmployeeById);
// // router.put('/:id', employeeController.updateEmployee);
// router.delete('/:id', employeeController.deleteEmployee);
// router.get('/DeviceLogs', employeeController.getEmployeeDeviceLogs);


// module.exports = router;


const express = require('express');
const router = express.Router();
const passport = require('../middleware/auth');
const employeeController = require('../controllers/employeeController');

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

router.post('/', passport.authenticate('jwt', { session: false }), restrictTo('HR Manager', 'Super Admin', 'Company Admin'), employeeController.createEmployee);
router.patch('/:id', passport.authenticate('jwt', { session: false }), restrictTo('HR Manager', 'Super Admin', 'Company Admin'), employeeController.updateEmployee);
router.get('/', passport.authenticate('jwt', { session: false }), restrictTo('HR Manager', 'Super Admin', 'Company Admin'), employeeController.getEmployees);
router.get('/:id', passport.authenticate('jwt', { session: false }), employeeController.getEmployeeById);
router.delete('/:id', passport.authenticate('jwt', { session: false }), restrictTo('HR Manager', 'Super Admin', 'Company Admin'), employeeController.deleteEmployee);
router.get('/deviceLogs', passport.authenticate('jwt', { session: false }), restrictTo('HR Manager', 'Super Admin', 'Company Admin'), employeeController.getEmployeeDeviceLogs);

module.exports = router;