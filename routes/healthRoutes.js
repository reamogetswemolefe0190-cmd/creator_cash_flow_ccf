// ==========================================================================
// Creator Cash Flow - Health & Deep Diagnostics Routes (/api/health)
// ==========================================================================

const express = require('express');
const router = express.Router();
const healthController = require('../controllers/healthController');

// Deep Diagnostics Health Check
router.get('/', healthController.getHealth);

module.exports = router;
