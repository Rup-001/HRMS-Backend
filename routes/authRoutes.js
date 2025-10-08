const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const passport = require('../middleware/auth');

router.post('/login', authController.login);
router.post('/accept-invitation', authController.acceptInvitation);
router.post('/change-password', 
  passport.authenticate('jwt', { session: false }), 
  authController.changePassword
);
router.post('/reset-password/:userId', 
  passport.authenticate('jwt', { session: false }), 
  authController.requestPasswordReset
);
router.post('/reset-password', authController.resetPassword);

module.exports = router;