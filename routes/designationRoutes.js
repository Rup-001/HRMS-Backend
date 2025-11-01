const express = require('express');
const router = express.Router();
const designationController = require('../controllers/designationController');

router.post('/', designationController.createDesignation);
router.get('/', designationController.getDesignations);
router.get('/department/:departmentId', designationController.getDesignationsByDepartment);

module.exports = router;