const express = require('express');
const router = express.Router();
const { uploadDocument, getDocuments, getDocumentById, getCommonDocuments, deleteDocument } = require('../controllers/documentController');
const { authenticate, restrictTo } = require('../middleware/auth');

router.post('/', restrictTo('HR Manager', 'Super Admin', 'Company Admin' , 'C-Level Executive'),  uploadDocument);
router.get('/', restrictTo('HR Manager', 'Super Admin', 'Company Admin', 'C-Level Executive'),  getDocuments);
router.post('/common', restrictTo('HR Manager', 'Super Admin', 'Company Admin'), uploadDocument);
router.get('/common', getCommonDocuments);
router.get('/:id', restrictTo('HR Manager', 'Super Admin', 'Company Admin', 'C-Level Executive'),  getDocumentById);
router.delete('/:id', restrictTo('HR Manager', 'Super Admin', 'Company Admin'), deleteDocument);

module.exports = router;