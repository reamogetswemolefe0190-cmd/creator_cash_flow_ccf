// ==========================================================================
// Creator Cash Flow - Gemini 1.5 Flash Serverless Proxy Endpoint
// Compatible with Vercel Serverless Functions & Netlify Functions
// ==========================================================================

const { generateContent } = require('../services/geminiService');

const ALLOWED_ORIGINS = [
    'https://creatorcashflow.co.za',
    'https://www.creatorcashflow.co.za',
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    'http://localhost:3000'
];

// Sliding-window rate limiter (15 requests per minute per IP)
const geminiRateLimitMap = new Map();
const GEMINI_WINDOW_MS = 60 * 1000;
const GEMINI_MAX_REQUESTS = 15;
const MAX_TRACKED_IPS = 500;

// Periodic active cleanup of expired entries
const geminiCleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of geminiRateLimitMap.entries()) {
        const valid = timestamps.filter(t => now - t < GEMINI_WINDOW_MS);
        if (valid.length === 0) {
            geminiRateLimitMap.delete(key);
        } else if (valid.length !== timestamps.length) {
            geminiRateLimitMap.set(key, valid);
        }
    }
}, 30000);
if (geminiCleanupTimer.unref) {
    geminiCleanupTimer.unref();
}

module.exports = async (req, res) => {
    const origin = req.headers ? (req.headers.origin || req.headers.Origin) : null;
    const isAllowedOrigin = !origin || ALLOWED_ORIGINS.includes(origin);

    if (origin && !isAllowedOrigin) {
        if (req.method === 'OPTIONS') {
            return res.status(403).end();
        }
        return res.status(403).json({ error: 'Blocked by CORS policy' });
    }

    // Set CORS headers
    const corsOrigin = origin && isAllowedOrigin ? origin : 'https://creatorcashflow.co.za';
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed. Use POST.' });
    }

    // Rate limiting enforcement
    const ip = req.headers ? (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || '127.0.0.1') : '127.0.0.1';
    const now = Date.now();
    let timestamps = geminiRateLimitMap.get(ip) || [];
    timestamps = timestamps.filter(t => now - t < GEMINI_WINDOW_MS);

    if (timestamps.length >= GEMINI_MAX_REQUESTS) {
        const oldest = timestamps[0];
        const retryAfterSecs = Math.max(1, Math.ceil((oldest + GEMINI_WINDOW_MS - now) / 1000));
        res.setHeader('Retry-After', retryAfterSecs);
        return res.status(429).json({
            error: 'Too many requests',
            message: `Rate limit exceeded. Too many AI queries from this IP. Please try again after ${retryAfterSecs} seconds.`,
            retryAfterSeconds: retryAfterSecs
        });
    }

    timestamps.push(now);
    geminiRateLimitMap.set(ip, timestamps);

    if (geminiRateLimitMap.size > MAX_TRACKED_IPS) {
        const oldestKey = geminiRateLimitMap.keys().next().value;
        geminiRateLimitMap.delete(oldestKey);
    }

    try {
        const { prompt, systemContext } = req.body || {};
        const result = await generateContent({ prompt, systemContext });
        return res.status(200).json({
            success: true,
            text: result.text,
            source: 'Gemini 1.5 Flash (Production Proxy)',
            tokensUsed: result.tokensUsed
        });
    } catch (error) {
        console.error('[GEMINI PROXY ERROR]', error);
        const status = error.statusCode || error.status || 500;
        return res.status(status).json({
            success: false,
            error: error.message || 'Gemini processing failed',
            code: error.code || 'AI_SERVICE_ERROR',
            fallback: true
        });
    }
};
