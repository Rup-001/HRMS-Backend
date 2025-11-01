const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');

router.post('/', departmentController.createDepartment);
router.get('/', departmentController.getDepartments);
router.get('/company/:companyId', departmentController.getDepartmentsByCompany);

module.exports = router;