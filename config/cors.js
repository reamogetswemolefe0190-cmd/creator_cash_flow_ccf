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

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
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
