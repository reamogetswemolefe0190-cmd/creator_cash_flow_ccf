const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { JWT_SECRET, RESEND_API_KEY, RESEND_API_URL, FROM_EMAIL } = require('../config/env');

// Middleware to protect agency routes
function requireAgency(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Missing authorization header' });

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== 'agency') {
            return res.status(403).json({ error: 'Access denied: Agency role required.' });
        }
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

router.post('/invite', requireAgency, async (req, res) => {
    const { email, invite_link } = req.body;
    
    if (!email || !invite_link) {
        return res.status(400).json({ error: 'Email and invite_link are required.' });
    }

    try {
        if (RESEND_API_KEY) {
            console.log('[RESEND] Sending agency invite email to:', email);
            const r = await fetch(RESEND_API_URL + '/emails', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + RESEND_API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    from: FROM_EMAIL,
                    to: email,
                    subject: req.user.name + ' has invited you to join their Creator Cash Flow roster',
                    html: '<p>Hello,</p><p><b>' + req.user.name + '</b> has invited you to connect your Creator Cash Flow account to their agency roster.</p><p>By joining their roster, you can easily share your verified YouTube/Instagram analytics and securely collaborate on campaigns.</p><p><a href="' + invite_link + '" style="background:#fff;color:#000;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;margin-top:16px;">Accept Invite & Join Roster</a></p>'
                })
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.message || 'Resend API Error');
        }

        res.json({ success: true, message: 'Invite sent' });
    } catch (err) {
        console.error('Invite error:', err);
        res.status(500).json({ error: 'Failed to send invite' });
    }
});

module.exports = router;
