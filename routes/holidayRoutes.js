const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const holidayController = require('../controllers/holidayController');
const { restrictTo } = require('../middleware/auth');

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'tmp/uploads'); // Temporarily store files
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

router.post('/', restrictTo('HR Manager', 'Super Admin', 'Company Admin'), holidayController.setHolidaysForYear);
router.get('/', holidayController.getHolidaysForYear);
router.post('/upload-excel', restrictTo('HR Manager', 'Super Admin', 'Company Admin'), upload.single('holidayFile'), holidayController.uploadHolidayCalendar);

module.exports = router;