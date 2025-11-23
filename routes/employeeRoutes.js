const express = require('express');
const router = express.Router();
const { authenticate, restrictTo } = require('../middleware/auth');
const employeeController = require('../controllers/employeeController');
const { uploadFiles } = require('../middleware/upload');

router.post('/', 
  authenticate('jwt', { session: false }), 
  restrictTo('HR Manager', 'Super Admin', 'Company Admin' ), 
  uploadFiles, 
  employeeController.createEmployee
);
router.patch('/:id', 
  authenticate('jwt', { session: false }), 
  restrictTo('HR Manager', 'Super Admin', 'Company Admin'), 
  uploadFiles, 
  employeeController.updateEmployee
);
router.get('/', 
  authenticate('jwt', { session: false }), 
  restrictTo('HR Manager', 'Super Admin', 'Company Admin', 'C-Level Executive'), 
  employeeController.getEmployees
);
router.get('/:id', 
  authenticate('jwt', { session: false }), 
  employeeController.getEmployeeById
);

router.get('/department/:departmentId/managers',
  authenticate('jwt', { session: false }),
  employeeController.getPotentialManagers
);

module.exports = router;