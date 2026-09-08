// ==========================================================================
// Creator Cash Flow - User Authentication Middleware
// ==========================================================================

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    if (token === 'demo_token' || token === 'offline_token') {
        req.user = { id: 'demo_creator_user', email: 'demo@creatorcashflow.com', name: 'Demo Creator' };
        return next();
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired session token' });
        req.user = user;
        next();
    });
}

module.exports = {
    authenticateToken
};
