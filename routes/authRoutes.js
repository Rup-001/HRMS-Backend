const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const passport = require("../middleware/auth")

router.post('/login', authController.login);
router.post('/accept-invitation', authController.acceptInvitation);
router.post('/change-password', passport.authenticate('jwt', { session: false }), authController.changePassword);

module.exports = router;