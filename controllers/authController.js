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
const { memoryDb, findUserByEmail } = require('../services/memoryDb');

async function signup(req, res) {
    if (process.env.NODE_ENV === 'production' && !supabase) {
        return res.status(503).json({ error: 'Account registration is temporarily unavailable. Please try again later.' });
    }
    try {
        const { email, password, name, role = 'creator', organization_name = '' } = req.body;
        
        // Validate role
        if (!['creator', 'agency', 'brand'].includes(role)) {
            return res.status(400).json({ error: 'Invalid account role.' });
        }

        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const userId = 'usr_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
        
        let orgId = null;
        if (role !== 'creator' && organization_name) {
            orgId = 'org_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
        }

        const newUserObj = {
            id: userId,
            email: email.toLowerCase(),
            passwordHash,
            password_hash: passwordHash,
            name,
            role,
            organization_id: orgId,
            plan_tier: 'Free',
            status: 'active',
            created_at: new Date().toISOString()
        };

        if (supabase) {
            const { data: existing } = await supabase.from('users').select('id').eq('email', email.toLowerCase()).maybeSingle();
            if (existing) {
                return res.status(400).json({ success: false, error: 'An account with this email already exists.', code: 'EMAIL_ALREADY_EXISTS' });
            }
            
            // Note: In production we need to handle creating the organization record first if orgId exists.
            // For now, we update users table to accept role and organization_id.
            if (orgId) {
                await supabase.from('organizations').insert([{
                    id: orgId,
                    name: organization_name,
                    type: role
                }]);
            }

            const { error } = await supabase.from('users').insert([{
                id: userId,
                email: email.toLowerCase(),
                password_hash: passwordHash,
                name,
                role,
                organization_id: orgId
            }]);

            if (error) throw error;
        } else {
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
            
            if (orgId) {
                if (!memoryDb.organizations) memoryDb.organizations = [];
                memoryDb.organizations.push({ id: orgId, name: organization_name, type: role });
            }
        }

        // Generate session token WITH role
        const token = jwt.sign(
            { id: userId, email: email.toLowerCase(), name, role, organization_id: orgId },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        if (RESEND_API_KEY) {
            console.log('[RESEND] Sending account welcome email');
            fetch(`${RESEND_API_URL}/emails`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${RESEND_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    from: FROM_EMAIL,
                    to: email.toLowerCase(),
                    subject: 'Welcome to Creator Cash Flow',
                    text: 'Welcome to Creator Cash Flow. Your account has been created. For support, contact reamogetswemolefe@creatorcashflow.co.za. This email does not verify ownership of your email address.'
                })
            }).catch(err => {
                console.error('[RESEND DISPATCH ERROR]', err);
            });
        }

        res.status(201).json({
            success: true,
            message: 'Registration successful!',
            userId,
            email,
            token,
            role
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error during signup.', code: 'SIGNUP_ERROR' });
    }
}

async function login(req, res) {
    if (process.env.NODE_ENV === 'production' && !supabase) {
        return res.status(503).json({ error: 'Sign-in is temporarily unavailable. Please try again later.' });
    }
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
                passwordHash: data.password_hash,
                role: data.role || 'creator',
                organization_id: data.organization_id || null
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
            { id: user.id, email: user.email, name: user.name, role: user.role || 'creator', organization_id: user.organization_id },
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
                email: user.email,
                role: user.role || 'creator'
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
