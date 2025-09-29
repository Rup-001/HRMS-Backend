const express = require('express');
const router = express.Router();
const payslipController = require('../controllers/payslipController');

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    next();
  };
};

router.post('/', restrictTo('HR Manager', 'Super Admin', 'Company Admin'), payslipController.generatePayslip);
router.get('/', payslipController.getPayslips);

module.exports = router;