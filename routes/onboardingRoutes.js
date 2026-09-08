// ==========================================================================
// Creator Cash Flow - Onboarding Responses Routes (/api/onboarding)
// ==========================================================================

const express = require('express');
const router = express.Router();
const onboardingController = require('../controllers/onboardingController');
const { authenticateToken } = require('../middleware/auth');

// Save onboarding responses
router.post('/save', authenticateToken, onboardingController.saveOnboarding);
router.post('/', authenticateToken, onboardingController.saveOnboarding);

module.exports = router;
