const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const passport = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication and password management
 */

/**
 * @swagger
 * /api/login:
 *   post:
 *     summary: Log in a user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successful login
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', authController.login);

/**
 * @swagger
 * /api/accept-invitation:
 *   post:
 *     summary: Accept an invitation and set a password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Invitation accepted
 *       400:
 *         description: Invalid or expired token
 */
router.post('/accept-invitation', authController.acceptInvitation);

/**
 * @swagger
 * /api/change-password:
 *   post:
 *     summary: Change a user's password
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               oldPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       401:
 *         description: Unauthorized
 *       400:
 *         description: Incorrect old password
 */
router.post('/change-password', 
  passport.authenticate('jwt', { session: false }), 
  authController.changePassword
);

/**
 * @swagger
 * /api/reset-password/{userId}:
 *   post:
 *     summary: Request a password reset for a user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Password reset email sent
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.post('/reset-password/:userId', 
  passport.authenticate('jwt', { session: false }), 
  authController.requestPasswordReset
);

/**
 * @swagger
 * /api/reset-password:
 *   post:
 *     summary: Reset a user's password using a token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid or expired token
 */
router.post('/reset-password', authController.resetPassword);

router.post('/resend-invitation', passport.authenticate('jwt', { session: false }), authController.resendInvitation);

router.post('/force-resend-invitation', passport.authenticate('jwt', { session: false }), authController.forceResendInvitation);

/**
 * @swagger
 * /api/initial-setup:
 *   post:
 *     summary: Perform initial setup and create the first Super Admin user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               companyName:
 *                 type: string
 *     responses:
 *       201:
 *         description: Initial setup complete, Super Admin created
 *       400:
 *         description: Missing required fields
 *       403:
 *         description: Initial setup already completed
 *       500:
 *         description: Server error
 */
router.post('/initial-setup', authController.initialSetup);

module.exports = router;