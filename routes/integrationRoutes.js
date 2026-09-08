// ==========================================================================
// Creator Cash Flow - Third-Party Integrations Routes (/api/integrations)
// ==========================================================================

const express = require('express');
const router = express.Router();
const integrationController = require('../controllers/integrationController');

// Phyllo SDK Token Dispatch (supports both POST and GET)
router.post('/phyllo/token', integrationController.getPhylloToken);
router.get('/phyllo/token', integrationController.getPhylloToken);

module.exports = router;
