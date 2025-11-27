const express = require('express');
const router = express.Router();
const { uploadRosterExcel, requestRemoteHours, approveRemoteHours, getMyRoster, getAllRosters } = require('../controllers/rosterController');
const { restrictTo } = require('../middleware/auth');
const multer = require('multer');

const upload = multer({ dest: 'Backend/tmp/roster-uploads/' });

const adminRoles = ['Super Admin', 'Company Admin', 'HR Manager'];
const approvalRoles = ['Super Admin', 'Company Admin'];

router.post('/upload', restrictTo(...adminRoles), upload.single('file'), uploadRosterExcel);
router.post('/remote/request', requestRemoteHours);
router.put('/remote/approve', restrictTo(...approvalRoles), approveRemoteHours);
// routes/roster.js  (add this route)
router.get('/my-roster', getMyRoster);
router.get('/all-rosters', restrictTo(...adminRoles), getAllRosters);
module.exports = router;