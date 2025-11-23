const express = require('express');
const router = express.Router();
const holidayController = require('../controllers/holidayController');
const { restrictTo } = require('../middleware/auth');

router.post('/', restrictTo('HR Manager', 'Super Admin', 'Company Admin'), holidayController.createHoliday);
router.get('/', holidayController.getHolidays);

module.exports = router;