const express = require('express');
const router = express.Router();
const youtubeController = require('../controllers/youtubeController');
const { authenticateToken } = require('../middleware/auth');

// Auth routes
router.post('/auth/login', authenticateToken, youtubeController.login);
router.get('/auth/callback', youtubeController.callback);
router.post('/auth/disconnect', authenticateToken, youtubeController.disconnect);

// Data routes
router.get('/metrics', authenticateToken, youtubeController.getMetrics);

module.exports = router;
