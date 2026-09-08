// ==========================================================================
// Creator Cash Flow - User Authentication Controller (Signup & Login)
// ==========================================================================

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const {
    JWT_SECRET,
    BCRYPT_ROUNDS,
    RESEND_API_KEY,
    RESEND_API_URL,
    FROM_EMAIL
} = require('../config/env');
const bcrypt = require('../services/bcrypt');
const { supabase } = require('../services/supabase');
const { memoryDb, findUserByEmail, seedDefaultTransactions } = require('../services/memoryDb');

async function signup(req, res) {
    try {
        const { email, password, name } = req.body;

        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const userId = 'usr_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');

        const newUserObj = {
            id: userId,
            email: email.toLowerCase(),
            passwordHash,
            password_hash: passwordHash,
            name,
            plan_tier: 'Free',
            status: 'active',
            created_at: new Date().toISOString()
        };

        if (supabase) {
            // Check if user exists in Supabase
            const { data: existing } = await supabase.from('users').select('id').eq('email', email.toLowerCase()).maybeSingle();
            if (existing) {
                return res.status(400).json({ success: false, error: 'An account with this email already exists.', code: 'EMAIL_ALREADY_EXISTS' });
            }

            // Insert into Supabase
            const { error } = await supabase.from('users').insert([{
                id: userId,
                email: email.toLowerCase(),
                password_hash: passwordHash,
                name
            }]);

            if (error) throw error;
        } else {
            // Check in memoryDb
            const existing = findUserByEmail(email);
            if (existing) {
                return res.status(400).json({ success: false, error: 'An account with this email already exists.', code: 'EMAIL_ALREADY_EXISTS' });
            }
        }

        // Dual-write to memoryDb so fallback reads are synchronized
        if (!memoryDb.usersByEmail.has(newUserObj.email)) {
            memoryDb.users.push(newUserObj);
            memoryDb.usersByEmail.set(newUserObj.email, newUserObj);
            memoryDb.usersById.set(newUserObj.id, newUserObj);
        }

        // Generate session token
        const token = jwt.sign(
            { id: userId, email: email.toLowerCase(), name },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Seed transactions asynchronously without awaiting before HTTP response
        seedDefaultTransactions(userId).catch(err => {
            console.warn('⚠️ seedDefaultTransactions notice:', err.message || err);
        });

        // Dispatch Live Transactional Email via Resend asynchronously
        if (RESEND_API_KEY) {
            console.log(`[RESEND] Sending welcome verification email to: ${email}`);
            fetch(`${RESEND_API_URL}/emails`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${RESEND_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    from: FROM_EMAIL,
                    to: email.toLowerCase(),
                    subject: 'Welcome to Creator Cash Flow — Your Business Command Center is Active',
                    html: `
                        <div style="background-color: #050505; color: #ffffff; padding: 48px 24px; font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; max-width: 600px; margin: 0 auto; border-radius: 24px; border: 1px solid rgba(255,255,255,0.08);">
                            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
                                <div style="background-color: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.3); border-radius: 12px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; color: #22C55E; font-size: 20px; font-weight: bold;">💸</div>
                                <span style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">Creator Cash Flow</span>
                            </div>
                            <h2 style="color: #22C55E; font-size: 24px; font-weight: 800; margin-bottom: 12px; letter-spacing: -0.02em;">Welcome aboard, ${name}!</h2>
                            <p style="color: #A1A1AA; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">Your Creator Business Command Center account is verified and ready. Track earnings, understand growth, and build a sustainable creator business.</p>
                            <div style="background-color: #0B0B0B; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 20px; margin-bottom: 24px;">
                                <div style="margin-bottom: 12px; font-size: 13px; display: flex; justify-content: space-between;">
                                    <span style="color: #71717A;">Creator Account:</span>
                                    <strong style="color: #ffffff;">${email}</strong>
                                </div>
                                <div style="font-size: 13px; display: flex; justify-content: space-between;">
                                    <span style="color: #71717A;">Command Center Status:</span>
                                    <strong style="color: #22C55E;">🟢 Verified & Active Sync</strong>
                                </div>
                            </div>
                            <h3 style="color: #ffffff; font-size: 15px; font-weight: 700; margin-bottom: 12px;">3 Steps to Get Started:</h3>
                            <ul style="color: #A1A1AA; font-size: 13px; line-height: 1.8; margin-bottom: 28px; padding-left: 20px;">
                                <li><strong>Connect Revenue Channels:</strong> Link YouTube, TikTok, or Patreon to auto-sync income.</li>
                                <li><strong>Tax Reserve Engine:</strong> View your automated 15% sole-proprietor tax reserve holding.</li>
                                <li><strong>AI Financial Intelligence:</strong> Chat with CCF AI for real-time equipment & P&L advice.</li>
                            </ul>
                            <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 20px; margin-top: 24px; text-align: center;">
                                <p style="color: #71717A; font-size: 12px; line-height: 1.5; margin: 0;">© 2026 REM Technological Solutions. All rights reserved.</p>
                                <p style="color: #52525B; font-size: 11px; margin-top: 6px;">Creator Cash Flow — Financial Intelligence for Modern Creators</p>
                            </div>
                        </div>
                    `
                })
            }).then(r => r.json()).then(emailData => {
                console.log('[RESEND SUCCESS] Welcome email sent:', emailData.id);
            }).catch(err => {
                console.error('[RESEND DISPATCH ERROR]', err);
            });
        }

        res.status(201).json({
            success: true,
            message: 'Registration successful!',
            userId,
            email,
            token
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error during signup.', code: 'SIGNUP_ERROR' });
    }
}

async function login(req, res) {
    try {
        const { email, password } = req.body;
        let user = null;

        if (supabase) {
            const { data, error } = await supabase.from('users').select('*').eq('email', email.toLowerCase()).single();
            if (!data || error) {
                return res.status(401).json({ success: false, error: 'Invalid email or password.', code: 'INVALID_CREDENTIALS' });
            }
            user = {
                id: data.id,
                name: data.name,
                email: data.email,
                passwordHash: data.password_hash
            };
        } else {
            const memUser = findUserByEmail(email);
            if (!memUser) {
                return res.status(401).json({ success: false, error: 'Invalid email or password.', code: 'INVALID_CREDENTIALS' });
            }
            user = memUser;
        }

        const validPassword = await bcrypt.compare(password, user.passwordHash);
        if (!validPassword) {
            return res.status(401).json({ success: false, error: 'Invalid email or password.', code: 'INVALID_CREDENTIALS' });
        }

        const sessionToken = jwt.sign(
            { id: user.id, email: user.email, name: user.name },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            message: 'Login successful',
            token: sessionToken,
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error during login.', code: 'LOGIN_ERROR' });
    }
}

module.exports = {
    signup,
    login
};
