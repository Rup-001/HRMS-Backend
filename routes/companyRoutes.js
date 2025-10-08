const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
// const passport = require('passport');
const { uploadCompanyLogo } = require('../middleware/upload');

router.post(
  '/',
//   uploadCompanyLogo,
  companyController.createCompany
);

router.get(
  '/',
  companyController.getCompanies
);

module.exports = router;