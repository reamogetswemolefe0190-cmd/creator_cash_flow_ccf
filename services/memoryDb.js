// ==========================================================================
// Creator Cash Flow - In-Memory Database Storage & Bounded TTL Buffers
// ==========================================================================

const {
    MASTER_ADMIN_EMAIL,
    MASTER_ADMIN_PASS,
    FALLBACK_ADMIN_EMAIL,
    FALLBACK_ADMIN_PASS,
    CREATOR_SEED_PASSWORD,
    BCRYPT_ROUNDS
} = require('../config/env');
const bcrypt = require('./bcrypt');
const { supabase, seedAdminAccountInSupabase, seedDefaultCreatorsInSupabase } = require('./supabase');

// Maximum bounded capacities to prevent memory exhaustion
const MAX_AUDIT_LOGS = 1000;
const MAX_TELEMETRY = 1000;
const MAX_TRANSACTIONS = 5000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// In-Memory Database Store
const memoryDb = {
    users: [],
    usersByEmail: new Map(),
    usersById: new Map(),
    transactions: [],
    transactionsByUserId: {},
    transactionIdsSet: new Set(),
    onboarding: [],
    organizations: [],
    organization_members: [],
    organization_invitations: [],
    campaigns: [],
    campaign_creators: [],
    campaign_deliverables: [],
    campaign_metric_snapshots: [],
    campaign_access_grants: [],
    campaign_milestones: [],
    campaign_messages: [],
    adminUsers: [],
    audit_logs: [],
    ai_telemetry: []
};

// Aliases for backward compatibility with test suites
Object.defineProperty(memoryDb, 'auditLogs', {
    get() { return this.audit_logs; },
    set(v) { this.audit_logs = v; },
    configurable: true,
    enumerable: true
});

Object.defineProperty(memoryDb, 'aiTelemetry', {
    get() { return this.ai_telemetry; },
    set(v) { this.ai_telemetry = v; },
    configurable: true,
    enumerable: true
});

// Admin Hash Calculations
const masterAdminHash = MASTER_ADMIN_PASS ? bcrypt.hashSync(MASTER_ADMIN_PASS, BCRYPT_ROUNDS) : '';
const fallbackAdminHash = FALLBACK_ADMIN_PASS ? bcrypt.hashSync(FALLBACK_ADMIN_PASS, BCRYPT_ROUNDS) : '';

// Seed primary master admin
if (MASTER_ADMIN_EMAIL && masterAdminHash && !memoryDb.adminUsers.some(a => a.email === MASTER_ADMIN_EMAIL)) {
    memoryDb.adminUsers.push({
        id: 'admin_master_1',
        email: MASTER_ADMIN_EMAIL,
        passwordHash: masterAdminHash,
        role: 'admin',
        created_at: new Date().toISOString()
    });
}

// Seed fallback admin
if (FALLBACK_ADMIN_EMAIL && fallbackAdminHash && !memoryDb.adminUsers.some(a => a.email === FALLBACK_ADMIN_EMAIL)) {
    memoryDb.adminUsers.push({
        id: 'admin_seed_1',
        email: FALLBACK_ADMIN_EMAIL,
        passwordHash: fallbackAdminHash,
        role: 'admin',
        created_at: new Date().toISOString()
    });
}

// Default Creator Registry Seeding for Baseline Platform Telemetry
const DEFAULT_SEED_CREATORS = [
    { id: 'usr_seed_1', name: 'Naledi Molefe', email: 'naledi@creator.co.za', plan_tier: 'Pro', status: 'active', created_at: '2026-02-15T10:00:00.000Z' },
    { id: 'usr_seed_2', name: 'Sipho Dlamini', email: 'sipho@vlogsa.co.za', plan_tier: 'Pro', status: 'active', created_at: '2026-03-01T11:20:00.000Z' },
    { id: 'usr_seed_3', name: 'Jessica van der Merwe', email: 'jessica@techreviews.co.za', plan_tier: 'Pro', status: 'active', created_at: '2026-03-18T14:15:00.000Z' },
    { id: 'usr_seed_4', name: 'Thabo Mokoena', email: 'thabo@fitnessza.co.za', plan_tier: 'Free', status: 'active', created_at: '2026-04-05T09:30:00.000Z' },
    { id: 'usr_seed_5', name: 'Chloe Adams', email: 'chloe@beautyblog.co.za', plan_tier: 'Pro', status: 'active', created_at: '2026-04-20T16:45:00.000Z' },
    { id: 'usr_seed_6', name: 'Bongani Sithole', email: 'bongani@gamingza.co.za', plan_tier: 'Pro', status: 'active', created_at: '2026-05-10T12:00:00.000Z' },
    { id: 'usr_seed_7', name: 'Fatima Patel', email: 'fatima@foodie.co.za', plan_tier: 'Free', status: 'active', created_at: '2026-06-01T08:10:00.000Z' },
    { id: 'usr_seed_8', name: 'Liam Botha', email: 'liam@travelsa.co.za', plan_tier: 'Pro', status: 'active', created_at: '2026-06-15T15:30:00.000Z' },
    { id: 'usr_seed_9', name: 'Zanele Khumalo', email: 'zanele@fashion.co.za', plan_tier: 'Free', status: 'active', created_at: '2026-07-02T13:00:00.000Z' },
    { id: 'usr_seed_10', name: 'Kabelo Mabena', email: 'kabelo@podcasts.co.za', plan_tier: 'Pro', status: 'suspended', created_at: '2026-07-12T17:20:00.000Z' }
];

const DEFAULT_SEED_TRANSACTIONS = [
    // YouTube
    { id: 'tx_seed_101', user_id: 'usr_seed_1', date: 'Feb 20', source: 'YouTube', merchant: 'Google AdSense SA', type: 'income', category: 'YouTube AdSense', tax_status: 'Taxable Income', amount: 45000.00, created_at: '2026-02-20T12:00:00.000Z' },
    { id: 'tx_seed_102', user_id: 'usr_seed_2', date: 'Mar 15', source: 'YouTube', merchant: 'Google AdSense SA', type: 'income', category: 'YouTube AdSense', tax_status: 'Taxable Income', amount: 35000.00, created_at: '2026-03-15T12:00:00.000Z' },
    { id: 'tx_seed_103', user_id: 'usr_seed_3', date: 'Apr 10', source: 'YouTube', merchant: 'Google AdSense SA', type: 'income', category: 'YouTube AdSense', tax_status: 'Taxable Income', amount: 52000.00, created_at: '2026-04-10T12:00:00.000Z' },
    { id: 'tx_seed_104', user_id: 'usr_seed_6', date: 'May 18', source: 'YouTube', merchant: 'Google AdSense SA', type: 'income', category: 'YouTube AdSense', tax_status: 'Taxable Income', amount: 48000.00, created_at: '2026-05-18T12:00:00.000Z' },
    { id: 'tx_seed_105', user_id: 'usr_seed_8', date: 'Jun 22', source: 'YouTube', merchant: 'Google AdSense SA', type: 'income', category: 'YouTube AdSense', tax_status: 'Taxable Income', amount: 60000.00, created_at: '2026-06-22T12:00:00.000Z' },
    { id: 'tx_seed_106', user_id: 'usr_seed_1', date: 'Jul 20', source: 'YouTube', merchant: 'Google AdSense SA', type: 'income', category: 'YouTube AdSense', tax_status: 'Taxable Income', amount: 55000.00, created_at: '2026-07-20T12:00:00.000Z' },

    // TikTok
    { id: 'tx_seed_201', user_id: 'usr_seed_4', date: 'Apr 25', source: 'TikTok', merchant: 'TikTok Creator Fund ZAR', type: 'income', category: 'TikTok Rewards', tax_status: 'Taxable Income', amount: 18000.00, created_at: '2026-04-25T12:00:00.000Z' },
    { id: 'tx_seed_202', user_id: 'usr_seed_5', date: 'May 05', source: 'TikTok', merchant: 'TikTok Creator Fund ZAR', type: 'income', category: 'TikTok Rewards', tax_status: 'Taxable Income', amount: 24000.00, created_at: '2026-05-05T12:00:00.000Z' },
    { id: 'tx_seed_203', user_id: 'usr_seed_7', date: 'Jun 12', source: 'TikTok', merchant: 'TikTok Creator Fund ZAR', type: 'income', category: 'TikTok Rewards', tax_status: 'Taxable Income', amount: 31000.00, created_at: '2026-06-12T12:00:00.000Z' },
    { id: 'tx_seed_204', user_id: 'usr_seed_9', date: 'Jul 05', source: 'TikTok', merchant: 'TikTok Creator Fund ZAR', type: 'income', category: 'TikTok Rewards', tax_status: 'Taxable Income', amount: 27000.00, created_at: '2026-07-05T12:00:00.000Z' },

    // Patreon
    { id: 'tx_seed_301', user_id: 'usr_seed_2', date: 'Mar 28', source: 'Patreon', merchant: 'Patreon Membership Payout', type: 'income', category: 'Patreon Subscriptions', tax_status: 'Taxable Income', amount: 22000.00, created_at: '2026-03-28T12:00:00.000Z' },
    { id: 'tx_seed_302', user_id: 'usr_seed_3', date: 'May 14', source: 'Patreon', merchant: 'Patreon Membership Payout', type: 'income', category: 'Patreon Subscriptions', tax_status: 'Taxable Income', amount: 28000.00, created_at: '2026-05-14T12:00:00.000Z' },
    { id: 'tx_seed_303', user_id: 'usr_seed_10', date: 'Jul 01', source: 'Patreon', merchant: 'Patreon Membership Payout', type: 'income', category: 'Patreon Subscriptions', tax_status: 'Taxable Income', amount: 35000.00, created_at: '2026-07-01T12:00:00.000Z' },

    // Brand Deals
    { id: 'tx_seed_401', user_id: 'usr_seed_5', date: 'Apr 18', source: 'Brand Deals', merchant: 'Woolworths SA Sponsorship', type: 'income', category: 'Brand Sponsorships', tax_status: 'Taxable Income', amount: 40000.00, created_at: '2026-04-18T12:00:00.000Z' },
    { id: 'tx_seed_402', user_id: 'usr_seed_8', date: 'Jun 28', source: 'Brand Deals', merchant: 'MTN SA Campaign', type: 'income', category: 'Brand Sponsorships', tax_status: 'Taxable Income', amount: 65000.00, created_at: '2026-06-28T12:00:00.000Z' },
    { id: 'tx_seed_403', user_id: 'usr_seed_1', date: 'Jul 15', source: 'Brand Deals', merchant: 'Nedbank Creator Grant', type: 'income', category: 'Brand Sponsorships', tax_status: 'Taxable Income', amount: 75000.00, created_at: '2026-07-15T12:00:00.000Z' }
];

// Seed Memory DB creators if empty
if (memoryDb.users.length === 0) {
    const creatorPassHash = CREATOR_SEED_PASSWORD ? bcrypt.hashSync(CREATOR_SEED_PASSWORD, BCRYPT_ROUNDS) : '';
    DEFAULT_SEED_CREATORS.forEach(c => {
        const u = {
            ...c,
            passwordHash: creatorPassHash
        };
        memoryDb.users.push(u);
        memoryDb.usersByEmail.set(u.email.toLowerCase(), u);
        memoryDb.usersById.set(u.id, u);
    });
}

// Seed Memory DB transactions if empty
if (memoryDb.transactions.length === 0) {
    memoryDb.transactions.push(...DEFAULT_SEED_TRANSACTIONS);
    DEFAULT_SEED_TRANSACTIONS.forEach(t => {
        memoryDb.transactionIdsSet.add(t.id);
        if (!memoryDb.transactionsByUserId[t.user_id]) {
            memoryDb.transactionsByUserId[t.user_id] = [];
        }
        memoryDb.transactionsByUserId[t.user_id].push(t);
    });
}

// Trigger Supabase Seeding
seedAdminAccountInSupabase();
seedDefaultCreatorsInSupabase(DEFAULT_SEED_CREATORS, DEFAULT_SEED_TRANSACTIONS);

// Safe Bounded In-Memory Appenders
function appendAuditLog(auditRecord) {
    memoryDb.audit_logs.push(auditRecord);
    if (memoryDb.audit_logs.length > MAX_AUDIT_LOGS) {
        memoryDb.audit_logs = memoryDb.audit_logs.slice(-MAX_AUDIT_LOGS);
    }
}

function pruneAiTelemetry() {
    const cutoffMs = Date.now() - THIRTY_DAYS_MS;
    if (Array.isArray(memoryDb.ai_telemetry)) {
        memoryDb.ai_telemetry = memoryDb.ai_telemetry
            .filter(entry => new Date(entry.created_at || entry.timestamp).getTime() >= cutoffMs)
            .slice(-MAX_TELEMETRY);
    }
}

function appendAiTelemetry(telemetryRecord) {
    pruneAiTelemetry();
    memoryDb.ai_telemetry.push(telemetryRecord);
    if (memoryDb.ai_telemetry.length > MAX_TELEMETRY) {
        memoryDb.ai_telemetry = memoryDb.ai_telemetry.slice(-MAX_TELEMETRY);
    }
}

// Active background unref sweep for memory safety
const memoryCleanupTimer = setInterval(() => {
    pruneAiTelemetry();
    if (Array.isArray(memoryDb.audit_logs) && memoryDb.audit_logs.length > MAX_AUDIT_LOGS) {
        memoryDb.audit_logs = memoryDb.audit_logs.slice(-MAX_AUDIT_LOGS);
    }
    if (Array.isArray(memoryDb.transactions) && memoryDb.transactions.length > MAX_TRANSACTIONS) {
        const excess = memoryDb.transactions.length - MAX_TRANSACTIONS;
        const removed = memoryDb.transactions.splice(0, excess);
        removed.forEach(tx => memoryDb.transactionIdsSet.delete(tx.id));
    }
}, 60 * 1000);

if (memoryCleanupTimer.unref) {
    memoryCleanupTimer.unref();
}

// Fast memory lookup for user by email
function findUserByEmail(email) {
    if (!email || typeof email !== 'string') return null;
    return memoryDb.usersByEmail.get(email.toLowerCase()) || null;
}

// Seed initial transaction data for newly registered creators
async function seedDefaultTransactions(userId) {
    const defaults = [
        { id: 'tx_seed_1_' + userId, user_id: userId, date: 'Jul 21', source: 'YouTube', merchant: 'Google AdSense South Africa Payout', type: 'income', category: 'YouTube AdSense', tax_status: 'Taxable Income', amount: 18420.00 },
        { id: 'tx_seed_2_' + userId, user_id: userId, date: 'Jul 19', source: 'Bank', merchant: 'Orms Direct (Sony Alpha Lens)', type: 'expense', category: 'Equipment & Gear', tax_status: '100% Tax Write-Off', amount: 4200.00 },
        { id: 'tx_seed_3_' + userId, user_id: userId, date: 'Jul 18', source: 'TikTok', merchant: 'TikTok Creator Rewards ZAR', type: 'income', category: 'TikTok Rewards', tax_status: 'Taxable Income', amount: 4850.00 },
        { id: 'tx_seed_4_' + userId, user_id: userId, date: 'Jul 15', source: 'Bank', merchant: 'Adobe Creative Cloud SA', type: 'expense', category: 'Software Subs', tax_status: '100% Tax Write-Off', amount: 950.00 },
        { id: 'tx_seed_5_' + userId, user_id: userId, date: 'Jul 14', source: 'Instagram', merchant: 'Woolworths SA Brand Deal', type: 'income', category: 'Brand Sponsorships', tax_status: 'Taxable Income', amount: 2100.00 }
    ];

    if (supabase) {
        try {
            await supabase.from('transactions').insert(defaults);
        } catch (err) {
            console.warn('⚠️ Supabase seedDefaultTransactions notice:', err.message);
        }
    }

    // Dual-write into memoryDb so fallback reads are synchronized
    if (!memoryDb.transactionsByUserId[userId]) {
        memoryDb.transactionsByUserId[userId] = [];
    }
    for (const d of defaults) {
        if (!memoryDb.transactionIdsSet.has(d.id)) {
            memoryDb.transactionIdsSet.add(d.id);
            memoryDb.transactions.push(d);
            memoryDb.transactionsByUserId[userId].push(d);
        }
    }
}

module.exports = {
    memoryDb,
    DEFAULT_SEED_CREATORS,
    DEFAULT_SEED_TRANSACTIONS,
    findUserByEmail,
    seedDefaultTransactions,
    appendAuditLog,
    appendAiTelemetry,
    pruneAiTelemetry,
    MAX_AUDIT_LOGS,
    MAX_TELEMETRY
};
