const express = require('express');
const router = express.Router();
const { uploadDocument, getDocuments, getDocumentById, getCommonDocuments } = require('../controllers/documentController');
const { authenticate, restrictTo } = require('../middleware/auth');

router.post('/', authenticate('jwt', { session: false }), restrictTo('HR Manager', 'Super Admin', 'Company Admin' , 'C-Level Executive'),  uploadDocument);
router.get('/', authenticate('jwt', { session: false }), restrictTo('HR Manager', 'Super Admin', 'Company Admin', 'C-Level Executive'),  getDocuments);
router.get('/:id', authenticate('jwt', { session: false }), restrictTo('HR Manager', 'Super Admin', 'Company Admin', 'C-Level Executive'),  getDocumentById);
router.get('/common', authenticate('jwt', { session: false }), getCommonDocuments);

module.exports = router;