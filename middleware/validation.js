// ==========================================================================
// Creator Cash Flow - Request Validation & Input Sanitization Middleware
// Enforces strict input schemas, bounds, and eliminates injection vectors
// ==========================================================================

/**
 * Strips HTML tags and normalizes whitespace
 * @param {string} str - Input string
 * @returns {string} - Cleaned string
 */
function sanitizeString(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>?/gm, '').replace(/[<>]/g, '').trim();
}

/**
 * Validates user signup / registration input
 * POST /api/auth/signup & POST /api/auth/register
 */
function validateSignup(req, res, next) {
    const { name, email, password } = req.body || {};

    // 1. Name validation
    if (!name || typeof name !== 'string') {
        return res.status(400).json({
            success: false,
            error: 'Name is required and must be a string.',
            code: 'INVALID_NAME'
        });
    }

    const trimmedName = sanitizeString(name);
    if (trimmedName.length < 2 || trimmedName.length > 70) {
        return res.status(400).json({
            success: false,
            error: 'Name must be between 2 and 70 characters.',
            code: 'INVALID_NAME_LENGTH'
        });
    }

    // 2. Email validation
    if (!email || typeof email !== 'string') {
        return res.status(400).json({
            success: false,
            error: 'Email is required and must be a string.',
            code: 'INVALID_EMAIL'
        });
    }

    const trimmedEmail = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (trimmedEmail.length > 254 || !emailRegex.test(trimmedEmail)) {
        return res.status(400).json({
            success: false,
            error: 'A valid email address is required.',
            code: 'INVALID_EMAIL_FORMAT'
        });
    }

    // 3. Password validation
    if (!password || typeof password !== 'string') {
        return res.status(400).json({
            success: false,
            error: 'Password is required and must be a string.',
            code: 'INVALID_PASSWORD'
        });
    }

    if (password.length < 8 || password.length > 128) {
        return res.status(400).json({
            success: false,
            error: 'Password must be between 8 and 128 characters.',
            code: 'INVALID_PASSWORD_LENGTH'
        });
    }

    // Mutate with sanitized/normalized values
    req.body.name = trimmedName;
    req.body.email = trimmedEmail.toLowerCase();
    next();
}

/**
 * Validates user login input
 * POST /api/auth/login
 */
function validateLogin(req, res, next) {
    const { email, password } = req.body || {};

    if (!email || typeof email !== 'string' || !email.trim()) {
        return res.status(400).json({
            success: false,
            error: 'Email is required and must be a valid string.',
            code: 'MISSING_EMAIL'
        });
    }

    const trimmedEmail = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (trimmedEmail.length > 254 || !emailRegex.test(trimmedEmail)) {
        return res.status(400).json({
            success: false,
            error: 'A valid email address is required.',
            code: 'INVALID_EMAIL_FORMAT'
        });
    }

    if (!password || typeof password !== 'string' || password.length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Password is required.',
            code: 'MISSING_PASSWORD'
        });
    }

    req.body.email = trimmedEmail.toLowerCase();
    next();
}

/**
 * Validates transaction creation input
 * POST /api/transactions
 */
function validateTransaction(req, res, next) {
    const { type, amount, merchant, desc, source, category, date } = req.body || {};

    // 1. Transaction Type
    if (!type || typeof type !== 'string') {
        return res.status(400).json({
            success: false,
            error: "Transaction type is required and must be 'income' or 'expense'.",
            code: 'INVALID_TRANSACTION_TYPE'
        });
    }

    const normalizedType = type.trim().toLowerCase();
    if (!['income', 'expense'].includes(normalizedType)) {
        return res.status(400).json({
            success: false,
            error: "Transaction type must be strictly 'income' or 'expense'.",
            code: 'INVALID_TRANSACTION_TYPE'
        });
    }

    // 2. Amount
    if (amount === undefined || amount === null || amount === '') {
        return res.status(400).json({
            success: false,
            error: 'Transaction amount is required.',
            code: 'MISSING_AMOUNT'
        });
    }

    // Strict type check: disallow arrays, objects, booleans, and non-number/non-string inputs
    if (Array.isArray(amount) || (typeof amount !== 'number' && typeof amount !== 'string')) {
        return res.status(400).json({
            success: false,
            error: 'Amount must be a positive finite number greater than 0.',
            code: 'INVALID_AMOUNT'
        });
    }

    // If string, ensure it strictly contains only digits and optional decimal (no trailing characters)
    if (typeof amount === 'string') {
        const trimmed = amount.trim();
        if (!/^\d+(\.\d+)?$/.test(trimmed)) {
            return res.status(400).json({
                success: false,
                error: 'Amount must be a positive finite number greater than 0.',
                code: 'INVALID_AMOUNT'
            });
        }
    }

    const parsedAmount = typeof amount === 'number' ? amount : parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({
            success: false,
            error: 'Amount must be a positive finite number greater than 0.',
            code: 'INVALID_AMOUNT'
        });
    }

    if (parsedAmount > 100000000) {
        return res.status(400).json({
            success: false,
            error: 'Amount exceeds maximum allowable transaction limit (100,000,000).',
            code: 'AMOUNT_EXCEEDS_LIMIT'
        });
    }

    // 3. Merchant / Description
    const rawMerchant = merchant !== undefined ? merchant : desc;
    if (!rawMerchant || typeof rawMerchant !== 'string' || !rawMerchant.trim()) {
        return res.status(400).json({
            success: false,
            error: 'Merchant description is required.',
            code: 'INVALID_MERCHANT'
        });
    }

    const sanitizedMerchant = sanitizeString(rawMerchant);
    if (sanitizedMerchant.length === 0 || sanitizedMerchant.length > 100) {
        return res.status(400).json({
            success: false,
            error: 'Merchant description must be between 1 and 100 characters.',
            code: 'INVALID_MERCHANT_LENGTH'
        });
    }

    // 4. Source (optional, max 50 chars)
    let sanitizedSource = source ? sanitizeString(String(source)) : '';
    if (sanitizedSource.length > 50) {
        sanitizedSource = sanitizedSource.slice(0, 50);
    }

    // 5. Category (optional, max 50 chars)
    let sanitizedCategory = category ? sanitizeString(String(category)) : '';
    if (sanitizedCategory.length > 50) {
        sanitizedCategory = sanitizedCategory.slice(0, 50);
    }

    // 6. Date (optional string)
    let sanitizedDate = date ? sanitizeString(String(date)) : '';
    if (sanitizedDate.length > 50) {
        sanitizedDate = sanitizedDate.slice(0, 50);
    }

    req.body.type = normalizedType;
    req.body.amount = Math.round(parsedAmount * 100) / 100;
    req.body.merchant = sanitizedMerchant;
    req.body.source = sanitizedSource || (normalizedType === 'income' ? 'Creator Revenue' : 'Operating Expense');
    req.body.category = sanitizedCategory;
    req.body.date = sanitizedDate;

    next();
}

/**
 * Validates admin creator status / plan tier mutation input
 * POST /api/admin/creators/:id/status
 */
function validateAdminStatusMutation(req, res, next) {
    const { status, plan_tier, planTier, note } = req.body || {};
    const effectivePlanTier = plan_tier !== undefined ? plan_tier : planTier;

    if (note !== undefined && note !== null) {
        if (typeof note !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Note must be a string.',
                code: 'INVALID_NOTE'
            });
        }
        const sanitizedNote = sanitizeString(note);
        if (sanitizedNote.length > 500) {
            return res.status(400).json({
                success: false,
                error: 'Note cannot exceed 500 characters.',
                code: 'NOTE_TOO_LONG'
            });
        }
        req.body.note = sanitizedNote;
    }

    if (status === undefined && effectivePlanTier === undefined && (note === undefined || note === null)) {
        return res.status(400).json({
            success: false,
            error: "Invalid mutation payload. Provide status ('active'/'suspended') or plan_tier ('Pro'/'Free').",
            code: 'EMPTY_MUTATION_PAYLOAD'
        });
    }

    if (status !== undefined) {
        if (typeof status !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Invalid status',
                code: 'INVALID_STATUS'
            });
        }
        const normStatus = status.trim().toLowerCase();
        if (!['active', 'suspended'].includes(normStatus)) {
            return res.status(400).json({
                success: false,
                error: "Invalid status value. Allowed values are 'active' or 'suspended'.",
                code: 'INVALID_STATUS_VALUE'
            });
        }
        req.body.status = normStatus;
    }

    if (effectivePlanTier !== undefined) {
        if (typeof effectivePlanTier !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Invalid plan_tier',
                code: 'INVALID_PLAN_TIER'
            });
        }
        const normPlan = effectivePlanTier.trim().toLowerCase();
        if (!['pro', 'free'].includes(normPlan)) {
            return res.status(400).json({
                success: false,
                error: "Invalid plan_tier value. Allowed values are 'Pro' or 'Free'.",
                code: 'INVALID_PLAN_TIER_VALUE'
            });
        }
        req.body.plan_tier = normPlan === 'pro' ? 'Pro' : 'Free';
    }

    next();
}

module.exports = {
    sanitizeString,
    validateSignup,
    validateLogin,
    validateTransaction,
    validateAdminStatusMutation
};
