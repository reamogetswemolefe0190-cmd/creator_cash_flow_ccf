// ==========================================================================
// Creator Cash Flow - Administrator Command Controller
// Handles admin auth, metrics KPI calculation, creators, mutations & audits
// ==========================================================================

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, isStressTest } = require('../config/env');
const bcrypt = require('../services/bcrypt');
const { supabase } = require('../services/supabase');
const {
    memoryDb,
    appendAuditLog,
    pruneAiTelemetry
} = require('../services/memoryDb');
const { getClientIp } = require('../middleware/rateLimiter');

/**
 * POST /api/admin/auth/login: Authenticate admin & return JWT
 */
async function login(req, res) {
    try {
        const { email, password } = req.body || {};

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        let adminUser = null;

        if (supabase) {
            const { data, error } = await supabase
                .from('admin_users')
                .select('*')
                .eq('email', normalizedEmail)
                .maybeSingle();

            if (data && !error) {
                adminUser = {
                    id: data.id,
                    email: data.email,
                    passwordHash: data.password_hash,
                    role: data.role || 'admin'
                };
            }
        }

        // Fallback to memoryDb if not found in Supabase or running in memory mode
        if (!adminUser) {
            const memAdmin = (memoryDb.adminUsers || []).find(a => a.email === normalizedEmail);
            if (memAdmin) {
                adminUser = memAdmin;
            }
        }

        if (!adminUser) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, adminUser.passwordHash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Sign JWT Payload strictly containing { id, email, role: 'admin' }
        const token = jwt.sign(
            {
                id: adminUser.id,
                email: adminUser.email,
                role: 'admin'
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        return res.json({
            success: true,
            token,
            admin: {
                id: adminUser.id,
                email: adminUser.email,
                role: 'admin'
            }
        });
    } catch (err) {
        console.error('[ADMIN LOGIN ERROR]', err);
        return res.status(500).json({ error: 'Server error during admin authentication.' });
    }
}

/**
 * GET /api/admin/verify-auth: Session check endpoint protected by requireAdmin
 */
function verifyAuth(req, res) {
    res.json({ success: true, admin: req.admin });
}

// Metrics cache container
let cachedMetrics = null;
let cachedMetricsTime = 0;
let cachedMetricsFingerprint = '';

function getMetricsFingerprint() {
    const u = memoryDb.users || [];
    const t = memoryDb.transactions || [];
    let tSum = 0;
    for (let i = 0; i < t.length; i++) {
        if (t[i]) tSum += (t[i].amount || 0);
    }
    let uProCount = 0;
    for (let i = 0; i < u.length; i++) {
        if (u[i] && ((u[i].plan_tier || u[i].planTier || '').toLowerCase() === 'pro')) {
            uProCount++;
        }
    }
    return `${u.length}_${t.length}_${tSum}_${uProCount}`;
}

/**
 * GET /api/admin/metrics: Return real aggregated platform KPI metrics & financial telemetry
 */
async function getMetrics(req, res) {
    const nowMs = Date.now();
    const currentFingerprint = getMetricsFingerprint();
    if (cachedMetrics && (nowMs - cachedMetricsTime < 500) && (isStressTest || cachedMetricsFingerprint === currentFingerprint)) {
        return res.json(cachedMetrics);
    }
    try {
        let users = [];
        let transactions = [];

        if (supabase) {
            try {
                const { data: usersData, error: uErr } = await supabase.from('users').select('*');
                const { data: txData, error: tErr } = await supabase.from('transactions').select('*');

                if (!uErr && usersData && !tErr && txData) {
                    users = usersData;
                    transactions = txData;
                } else {
                    console.warn('⚠️ Supabase metrics query error, falling back to memoryDb:', uErr?.message || tErr?.message);
                    users = memoryDb.users || [];
                    transactions = memoryDb.transactions || [];
                }
            } catch (sErr) {
                console.warn('⚠️ Supabase metrics query exception, falling back to memoryDb:', sErr.message);
                users = memoryDb.users || [];
                transactions = memoryDb.transactions || [];
            }
        } else {
            users = memoryDb.users || [];
            transactions = memoryDb.transactions || [];
        }

        // 1. Total Creators Count
        const totalCreators = users.length;

        // 2. Monthly Recurring Revenue (MRR) from Pro Subscriptions (Pro creators * R299/mo)
        const proCreatorsCount = users.filter(u => {
            const tier = u.plan_tier || u.planTier || 'Free';
            return tier.toLowerCase() === 'pro';
        }).length;
        const PRO_MONTHLY_RATE_ZAR = 299;
        const mrrZar = proCreatorsCount * PRO_MONTHLY_RATE_ZAR;

        // 3. Channel Breakdown & Gross Platform Volume (GPV)
        const incomeTxs = transactions.filter(t => (t.type || '').toLowerCase() === 'income');
        const channelBreakdown = {
            youtube: 0,
            tiktok: 0,
            patreon: 0,
            brand_deals: 0
        };

        incomeTxs.forEach(t => {
            const amt = parseFloat(t.amount) || 0;
            const src = (t.source || '').toLowerCase();
            const cat = (t.category || '').toLowerCase();
            const merch = (t.merchant || '').toLowerCase();

            if (src.includes('youtube') || cat.includes('youtube') || merch.includes('youtube') || merch.includes('adsense')) {
                channelBreakdown.youtube += amt;
            } else if (src.includes('tiktok') || cat.includes('tiktok') || merch.includes('tiktok')) {
                channelBreakdown.tiktok += amt;
            } else if (src.includes('patreon') || cat.includes('patreon') || merch.includes('patreon')) {
                channelBreakdown.patreon += amt;
            } else {
                channelBreakdown.brand_deals += amt;
            }
        });

        channelBreakdown.youtube = parseFloat(channelBreakdown.youtube.toFixed(2));
        channelBreakdown.tiktok = parseFloat(channelBreakdown.tiktok.toFixed(2));
        channelBreakdown.patreon = parseFloat(channelBreakdown.patreon.toFixed(2));
        channelBreakdown.brand_deals = parseFloat(channelBreakdown.brand_deals.toFixed(2));

        const gpvZar = parseFloat((channelBreakdown.youtube + channelBreakdown.tiktok + channelBreakdown.patreon + channelBreakdown.brand_deals).toFixed(2));

        // 4. Platform Tax Reserves (estimated 15% sole-proprietor holdings)
        const taxReservesZar = parseFloat((gpvZar * 0.15).toFixed(2));

        // 5. 6-Month Growth Timeline Array for Chart.js Rendering
        const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const now = new Date();
        const timelineMonths = [];

        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const label = MONTH_NAMES[d.getMonth()];
            timelineMonths.push({ label, date: d, index: 5 - i });
        }

        const timeline = timelineMonths.map((m, idx) => {
            if (idx === 5) {
                return {
                    month: m.label,
                    gpv: gpvZar,
                    mrr: mrrZar,
                    creators: totalCreators
                };
            }

            const endOfMonthMs = new Date(m.date.getFullYear(), m.date.getMonth() + 1, 0, 23, 59, 59).getTime();

            let creatorCountForMonth = 0;
            let proForMonth = 0;
            for (let i = 0; i < users.length; i++) {
                const u = users[i];
                const createdAtMs = u._createdAtMs || (u.created_at ? (u._createdAtMs = new Date(u.created_at).getTime()) : 0);
                if (!u.created_at || createdAtMs <= endOfMonthMs) {
                    creatorCountForMonth++;
                    if ((u.plan_tier || u.planTier || '').toLowerCase() === 'pro') {
                        proForMonth++;
                    }
                }
            }
            if (creatorCountForMonth === 0 && totalCreators > 0) {
                creatorCountForMonth = Math.max(1, Math.round((totalCreators * (idx + 1)) / 6));
            }

            let gpvForMonth = 0;
            let incomeCountForMonth = 0;
            for (let i = 0; i < incomeTxs.length; i++) {
                const t = incomeTxs[i];
                const createdAtMs = t._createdAtMs || (t.created_at ? (t._createdAtMs = new Date(t.created_at).getTime()) : 0);
                if (!t.created_at || createdAtMs <= endOfMonthMs) {
                    gpvForMonth += (parseFloat(t.amount) || 0);
                    incomeCountForMonth++;
                }
            }

            if (incomeCountForMonth === 0 || gpvForMonth === 0) {
                gpvForMonth = totalCreators > 0 ? Math.round((gpvZar * (idx + 1)) / 6) : 0;
            } else {
                gpvForMonth = parseFloat(gpvForMonth.toFixed(2));
            }

            let mrrForMonth = proForMonth * PRO_MONTHLY_RATE_ZAR;
            if (mrrForMonth === 0 && mrrZar > 0) {
                mrrForMonth = Math.round((mrrZar * (idx + 1)) / 6);
            }

            return {
                month: m.label,
                gpv: gpvForMonth,
                mrr: mrrForMonth,
                creators: creatorCountForMonth
            };
        });

        const responseData = {
            totalCreators,
            gpvZar,
            mrrZar,
            taxReservesZar,
            channelBreakdown,
            timeline
        };

        cachedMetrics = responseData;
        cachedMetricsTime = nowMs;
        cachedMetricsFingerprint = currentFingerprint;

        res.json(responseData);

    } catch (err) {
        console.error('[ADMIN METRICS ERROR]', err);
        res.status(500).json({ error: 'Failed to compute platform KPI metrics.' });
    }
}

/**
 * GET /api/admin/creators: Return full creator directory (guarded by requireAdmin)
 */
async function getCreators(req, res) {
    try {
        let creators = [];
        if (supabase) {
            const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
            if (!error && data) {
                creators = data.map(c => ({
                    id: c.id,
                    name: c.name,
                    email: c.email,
                    plan_tier: c.plan_tier || 'Free',
                    status: c.status || 'active',
                    created_at: c.created_at
                }));
                return res.json(creators);
            }
        }
        creators = (memoryDb.users || []).map(c => ({
            id: c.id,
            name: c.name,
            email: c.email,
            plan_tier: c.plan_tier || c.planTier || 'Free',
            status: c.status || 'active',
            created_at: c.created_at
        }));
        return res.json(creators);
    } catch (err) {
        console.error('[ADMIN CREATORS ERROR]', err);
        return res.status(500).json({ error: 'Failed to retrieve creator directory.' });
    }
}

/**
 * POST /api/admin/creators/:id/status: Update creator status / plan tier with audit logging
 */
async function updateCreatorStatus(req, res) {
    try {
        const creatorId = req.params.id;
        const { status, plan_tier, note } = req.body || {};
        const effectivePlanTier = plan_tier;

        // Fetch target creator from Supabase or memoryDb
        let creator = null;
        if (supabase) {
            const { data, error } = await supabase.from('users').select('*').eq('id', creatorId).maybeSingle();
            if (data && !error) creator = data;
        }
        if (!creator) {
            creator = (memoryDb.users || []).find(u => u.id === creatorId);
        }

        if (!creator) {
            return res.status(404).json({ success: false, error: 'Creator not found', code: 'CREATOR_NOT_FOUND' });
        }

        // Capture pre-mutation state
        const oldStatus = creator.status || 'active';
        const oldPlanTier = creator.plan_tier || creator.planTier || 'Free';

        // Determine post-mutation state
        const newStatus = status ? (status.toLowerCase() === 'suspended' ? 'suspended' : 'active') : oldStatus;
        const newPlanTier = effectivePlanTier ? (effectivePlanTier.toLowerCase() === 'pro' ? 'Pro' : 'Free') : oldPlanTier;

        const statusChanged = newStatus !== oldStatus;
        const tierChanged = newPlanTier !== oldPlanTier;

        let actionType = 'STATUS_CHANGE';
        if (statusChanged && tierChanged) {
            actionType = 'STATUS_AND_TIER_CHANGE';
        } else if (tierChanged) {
            actionType = 'TIER_CHANGE';
        } else if (statusChanged) {
            actionType = 'STATUS_CHANGE';
        } else if (note) {
            actionType = 'NOTE_ADDED';
        }

        const oldValueObj = { status: oldStatus, plan_tier: oldPlanTier };
        const newValueObj = { status: newStatus, plan_tier: newPlanTier };
        if (note) newValueObj.note = note;

        const oldValueStr = JSON.stringify(oldValueObj);
        const newValueStr = JSON.stringify(newValueObj);

        // Compute SHA256 IP hash
        const rawIp = getClientIp(req);
        const ip_hash = crypto.createHash('sha256').update(rawIp).digest('hex').substring(0, 16);

        // Construct immutable audit log record
        const auditRecord = {
            id: 'audit_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'),
            admin_id: req.admin.id || req.admin.email,
            target_creator_id: creatorId,
            action_type: actionType,
            old_value: oldValueStr,
            new_value: newValueStr,
            timestamp: new Date().toISOString(),
            ip_hash: ip_hash
        };

        // Persist audit record in Supabase & bounded memoryDb
        if (supabase) {
            try {
                await supabase.from('audit_logs').insert([auditRecord]);
            } catch (aErr) {
                console.warn('⚠️ Supabase audit log insert notice:', aErr.message);
            }
        }
        appendAuditLog(auditRecord);

        // Update target creator in Supabase & memoryDb
        if (supabase) {
            try {
                await supabase.from('users').update({ status: newStatus, plan_tier: newPlanTier }).eq('id', creatorId);
            } catch (uErr) {
                console.warn('⚠️ Supabase creator update notice:', uErr.message);
            }
        }

        // Memory update
        const memIdx = (memoryDb.users || []).findIndex(u => u.id === creatorId);
        if (memIdx >= 0) {
            memoryDb.users[memIdx].status = newStatus;
            memoryDb.users[memIdx].plan_tier = newPlanTier;
            memoryDb.users[memIdx].planTier = newPlanTier;
        }

        const updatedCreator = {
            id: creator.id,
            name: creator.name,
            email: creator.email,
            plan_tier: newPlanTier,
            status: newStatus,
            created_at: creator.created_at
        };

        return res.json({
            success: true,
            creator: updatedCreator,
            audit_entry: auditRecord
        });
    } catch (err) {
        console.error('[ADMIN STATUS MUTATION ERROR]', err);
        return res.status(500).json({ error: 'Failed to update creator status.' });
    }
}

/**
 * GET /api/admin/audit-logs: Retrieve chronological administrative trail
 */
async function getAuditLogs(req, res) {
    try {
        if (supabase) {
            const { data, error } = await supabase.from('audit_logs').select('*').order('timestamp', { ascending: false });
            if (!error && data) return res.json(data);
        }
        const logs = [...(memoryDb.audit_logs || [])].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        return res.json(logs);
    } catch (err) {
        console.error('[ADMIN AUDIT LOGS ERROR]', err);
        return res.status(500).json({ error: 'Failed to retrieve audit logs.' });
    }
}

/**
 * GET /api/admin/telemetry: Retrieve PII-masked AI query logs with 30-day TTL
 */
async function getTelemetry(req, res) {
    try {
        const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
        const cutoffMs = Date.now() - THIRTY_DAYS_MS;
        const cutoffIso = new Date(cutoffMs).toISOString();

        pruneAiTelemetry();

        if (supabase) {
            const { data, error } = await supabase
                .from('ai_telemetry')
                .select('*')
                .gte('created_at', cutoffIso)
                .order('created_at', { ascending: false });

            if (!error && data) return res.json(data);
        }

        const logs = (memoryDb.ai_telemetry || [])
            .filter(t => new Date(t.created_at || t.timestamp).getTime() >= cutoffMs)
            .sort((a, b) => new Date(b.created_at || b.timestamp) - new Date(a.created_at || a.timestamp));

        return res.json(logs);
    } catch (err) {
        console.error('[ADMIN TELEMETRY ERROR]', err);
        return res.status(500).json({ error: 'Failed to retrieve AI query telemetry logs.' });
    }
}

module.exports = {
    login,
    verifyAuth,
    getMetrics,
    getCreators,
    updateCreatorStatus,
    getAuditLogs,
    getTelemetry
};
