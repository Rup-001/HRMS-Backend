const express = require('express');
const router = express.Router();
const deviceLogsController = require('../controllers/deviceLogsController');

router.get('/test-connection', deviceLogsController.testConnection);
router.get('/sync-users', deviceLogsController.syncUsers);
router.get('/sync-logs', deviceLogsController.syncLogs);
router.post('/create-User', deviceLogsController.createUser);
// router.get('/report', deviceLogsController.getReport);
// router.get('/attendance-dashboard', deviceLogsController.getAttendanceDashboard);
// router.post('/holidays', deviceLogsController.addHoliday);
// router.post('/leave-requests', deviceLogsController.createLeaveRequest);
// router.get('/leave-balances', deviceLogsController.getLeaveBalances);
// router.put('/leave-balances', deviceLogsController.updateLeaveQuotas);
// router.post('/jobs/update-daily-status', deviceLogsController.updateDailyStatus);

module.exports = router;
