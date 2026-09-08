// ==========================================================================
// Creator Cash Flow - User Authentication Routes (/api/auth)
// ==========================================================================

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authRateLimiter } = require('../middleware/rateLimiter');
const { validateSignup, validateLogin } = require('../middleware/validation');

// User Registration
router.post('/signup', authRateLimiter, validateSignup, authController.signup);
router.post('/register', authRateLimiter, validateSignup, authController.signup);

// User Login
router.post('/login', authRateLimiter, validateLogin, authController.login);

module.exports = router;
