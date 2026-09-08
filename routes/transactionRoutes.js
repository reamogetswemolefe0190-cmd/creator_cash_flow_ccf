// ==========================================================================
// Creator Cash Flow - Transactions & Cash Flow Ledger Routes (/api/transactions)
// ==========================================================================

const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { authenticateToken } = require('../middleware/auth');
const { transactionRateLimiter } = require('../middleware/rateLimiter');
const { validateTransaction } = require('../middleware/validation');

// List authenticated creator transactions
router.get('/', authenticateToken, transactionRateLimiter, transactionController.getTransactions);

// Record new transaction
router.post('/', authenticateToken, transactionRateLimiter, validateTransaction, transactionController.createTransaction);

module.exports = router;
