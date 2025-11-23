const express = require('express');
const router = express.Router();
const payslipController = require('../controllers/payslipController');
const { restrictTo } = require('../middleware/auth');

router.post('/', restrictTo('HR Manager', 'Super Admin', 'Company Admin'), payslipController.generatePayslip);
router.get('/', payslipController.getPayslips);

module.exports = router;