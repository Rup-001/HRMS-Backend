const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

router.get('/', dashboardController.getEmployeeDashboard);
router.get('/dashboard-stats', dashboardController.getDashboardStats);

module.exports = router;