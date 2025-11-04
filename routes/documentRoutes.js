const express = require('express');
const router = express.Router();
const { uploadDocument, getDocuments, getDocumentById, getCommonDocuments } = require('../controllers/documentController');
const authMiddleware = require('../middleware/auth'); // Assuming you have auth middleware
const passport = require('../middleware/auth');

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    if (req.user.role === 'Manager' || req.user.role === 'Employee') {
      if (req.body.companyId && req.body.companyId !== req.user.companyId.toString()) {
        return res.status(403).json({ success: false, error: 'Company access denied' });
      }
    }
    next();
  };
};
router.post('/', passport.authenticate('jwt', { session: false }), restrictTo('HR Manager', 'Super Admin', 'Company Admin' , 'C-Level Executive'),  uploadDocument);
router.get('/', passport.authenticate('jwt', { session: false }), restrictTo('HR Manager', 'Super Admin', 'Company Admin', 'C-Level Executive'),  getDocuments);
router.get('/:id', passport.authenticate('jwt', { session: false }), restrictTo('HR Manager', 'Super Admin', 'Company Admin', 'C-Level Executive'),  getDocumentById);
router.get('/common', passport.authenticate('jwt', { session: false }), getCommonDocuments);

module.exports = router;