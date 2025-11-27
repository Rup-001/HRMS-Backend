const express = require('express');
const router = express.Router();
const {
  createShiftTemplate,
  getShiftTemplates,
  updateShiftTemplate,
  deleteShiftTemplate,
} = require('../controllers/shiftTemplateController');
const { restrictTo } = require('../middleware/auth');

const adminRoles = ['Super Admin', 'Company Admin', 'HR Manager'];

router
  .route('/')
  .post(restrictTo(...adminRoles), createShiftTemplate)
  .get(getShiftTemplates);

router
  .route('/:id')
  .put(restrictTo(...adminRoles), updateShiftTemplate)
  .delete(restrictTo(...adminRoles), deleteShiftTemplate);

module.exports = router;
