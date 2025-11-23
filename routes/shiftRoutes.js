const express = require('express');
const router = express.Router();
const shiftController = require('../controllers/shiftController');
const { authenticate, restrictTo } = require('../middleware/auth');

// All shift routes require authentication
router.use(authenticate('jwt', { session: false }));

// Create a new shift
router.post('/', restrictTo('HR Manager', 'Super Admin', 'Company Admin'), shiftController.createShift);

// Get all shifts for a company
router.get('/', restrictTo('HR Manager', 'Super Admin', 'Company Admin', 'C-Level Executive', 'Manager', 'Employee'), shiftController.getAllShifts);

// Get all employees for a given shift
router.get('/employees', restrictTo('HR Manager', 'Super Admin', 'Company Admin', 'C-Level Executive', 'Manager', 'Employee'), shiftController.getEmployees);

// Get a single shift by ID
router.get('/:id', restrictTo('HR Manager', 'Super Admin', 'Company Admin', 'C-Level Executive', 'Manager', 'Employee'), shiftController.getShiftById);

// Update a shift
router.patch('/:id', restrictTo('HR Manager', 'Super Admin', 'Company Admin'), shiftController.updateShift);

// Delete a shift
router.delete('/:id', restrictTo('HR Manager', 'Super Admin', 'Company Admin'), shiftController.deleteShift);

// Assign a shift to multiple employees
router.post('/assign', restrictTo('HR Manager', 'Super Admin', 'Company Admin'), shiftController.assignShiftToEmployees);

// Remove an employee from a shift
router.delete('/:employeeId/remove', restrictTo('HR Manager', 'Super Admin', 'Company Admin'), shiftController.removeEmployeeFromShift);

// Get all employees for a given shift
router.get('/employees', restrictTo('HR Manager', 'Super Admin', 'Company Admin', 'C-Level Executive', 'Manager', 'Employee'), shiftController.getEmployees);

module.exports = router;
