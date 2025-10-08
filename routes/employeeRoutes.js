const express = require('express');
const router = express.Router();
const passport = require('../middleware/auth');
const employeeController = require('../controllers/employeeController');
const { uploadFiles } = require('../middleware/upload');

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

router.post('/', 
  passport.authenticate('jwt', { session: false }), 
  restrictTo('HR Manager', 'Super Admin', 'Company Admin' ), 
  uploadFiles, 
  employeeController.createEmployee
);
router.patch('/:id', 
  passport.authenticate('jwt', { session: false }), 
  restrictTo('HR Manager', 'Super Admin', 'Company Admin'), 
  uploadFiles, 
  employeeController.updateEmployee
);
router.get('/', 
  passport.authenticate('jwt', { session: false }), 
  restrictTo('HR Manager', 'Super Admin', 'Company Admin', 'C-Level Executive'), 
  employeeController.getEmployees
);
router.get('/:id', 
  passport.authenticate('jwt', { session: false }), 
  employeeController.getEmployeeById
);

module.exports = router;