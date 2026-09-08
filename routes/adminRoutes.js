// ==========================================================================
// Creator Cash Flow - Administrator Routes (/api/admin)
// ==========================================================================

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAdmin } = require('../middleware/adminAuth');
const {
    rateLimitAdminLogin,
    adminMutationRateLimiter
} = require('../middleware/rateLimiter');
const { validateAdminStatusMutation } = require('../middleware/validation');

// Administrator Authentication & Session Check
router.post('/auth/login', rateLimitAdminLogin, adminController.login);
router.get('/verify-auth', requireAdmin, adminController.verifyAuth);
router.get('/auth/verify', requireAdmin, adminController.verifyAuth);

// Platform KPI Metrics & Analytics
router.get('/metrics', requireAdmin, adminController.getMetrics);

// Creator Management & Directory
router.get('/creators', requireAdmin, adminController.getCreators);
router.post('/creators/:id/status', requireAdmin, adminMutationRateLimiter, validateAdminStatusMutation, adminController.updateCreatorStatus);

// Immutable Audit Ledger & AI Telemetry
router.get('/audit-logs', requireAdmin, adminController.getAuditLogs);
router.get('/telemetry', requireAdmin, adminController.getTelemetry);

module.exports = router;
