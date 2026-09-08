// ==========================================================================
// Creator Cash Flow - Gemini AI Routes (/api/gemini)
// ==========================================================================

const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { geminiRateLimiter } = require('../middleware/rateLimiter');

// Gemini AI Query & Telemetry Proxy
router.post('/', geminiRateLimiter, aiController.handleGemini);

module.exports = router;
