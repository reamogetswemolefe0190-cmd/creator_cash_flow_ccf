// ==========================================================================
// Creator Cash Flow - Administrator Role Authorization Middleware
// ==========================================================================

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');

function requireAdmin(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        if (!decoded || decoded.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden: Administrative privileges required' });
        }
        req.admin = decoded;
        next();
    });
}

module.exports = {
    requireAdmin
};
