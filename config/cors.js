// ==========================================================================
// Creator Cash Flow - Explicit Whitelist CORS Configuration
// ==========================================================================

const cors = require('cors');

const ALLOWED_ORIGINS = [
    'https://creatorcashflow.co.za',
    'https://www.creatorcashflow.co.za',
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    'http://localhost:3000'
];

function isOriginAllowed(origin) {
    if (!origin) return true;
    if (ALLOWED_ORIGINS.includes(origin)) return true;
    try {
        const parsed = new URL(origin);
        if (parsed.hostname.endsWith('.onrender.com') || parsed.hostname === 'onrender.com') {
            return true;
        }
    } catch {
        return false;
    }
    return false;
}

const corsOptions = {
    origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
            callback(null, true);
        } else {
            const corsError = new Error('Blocked by CORS policy');
            corsError.status = 403;
            callback(corsError);
        }
    },
    credentials: true
};

const corsMiddleware = cors(corsOptions);

function corsErrorHandler(req, res, next) {
    corsMiddleware(req, res, (err) => {
        if (err) {
            if (err.message === 'Blocked by CORS policy' || err.status === 403) {
                return res.status(403).json({ success: false, error: 'Blocked by CORS policy', code: 'CORS_ERROR' });
            }
            return next(err);
        }
        next();
    });
}

module.exports = {
    ALLOWED_ORIGINS,
    corsOptions,
    corsMiddleware,
    corsErrorHandler
};
