// ==========================================================================
// Creator Cash Flow - Third-Party Integrations Routes (/api/integrations)
// ==========================================================================

const express = require('express');
const router = express.Router();
const integrationController = require('../controllers/integrationController');
const { authenticateToken } = require('../middleware/auth');
const { createInstagramRouter } = require('./instagramRoutes');

router.use('/instagram', createInstagramRouter());

// Creator consent is mandatory. SDK tokens are short-lived and never public.
router.get('/phyllo/status', authenticateToken, integrationController.getPhylloStatus);
router.post('/phyllo/token', authenticateToken, integrationController.getPhylloToken);

module.exports = router;
