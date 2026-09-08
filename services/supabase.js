// ==========================================================================
// Creator Cash Flow - Supabase Cloud Database Client & Helpers
// ==========================================================================

const { createClient } = require('@supabase/supabase-js');
const {
    isStressTest,
    SUPABASE_URL,
    SUPABASE_KEY,
    MASTER_ADMIN_EMAIL,
    MASTER_ADMIN_PASS,
    FALLBACK_ADMIN_EMAIL,
    FALLBACK_ADMIN_PASS,
    CREATOR_SEED_PASSWORD,
    BCRYPT_ROUNDS
} = require('../config/env');
const bcrypt = require('./bcrypt');

let supabase = null;

if (!isStressTest && SUPABASE_URL && SUPABASE_KEY && SUPABASE_KEY !== 'your-supabase-anon-key') {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('🔌 Connected to Supabase Cloud Database: ' + SUPABASE_URL);
} else {
    console.log('⚠️ Supabase credentials not fully configured. Running in high-reliability Memory Backup Mode.');
}

// Auto-seeding helper for Admin User in Supabase
async function seedAdminAccountInSupabase() {
    if (!supabase) return;
    try {
        const masterHash = MASTER_ADMIN_PASS ? bcrypt.hashSync(MASTER_ADMIN_PASS, BCRYPT_ROUNDS) : '';
        const fallbackHash = FALLBACK_ADMIN_PASS ? bcrypt.hashSync(FALLBACK_ADMIN_PASS, BCRYPT_ROUNDS) : '';
        const adminsToSeed = [
            ...(MASTER_ADMIN_EMAIL && masterHash ? [{ id: 'admin_master_1', email: MASTER_ADMIN_EMAIL, password_hash: masterHash, role: 'admin' }] : []),
            ...(FALLBACK_ADMIN_EMAIL && fallbackHash ? [{ id: 'admin_seed_1', email: FALLBACK_ADMIN_EMAIL, password_hash: fallbackHash, role: 'admin' }] : [])
        ];
        for (const adm of adminsToSeed) {
            const { data: existing } = await supabase
                .from('admin_users')
                .select('id')
                .eq('email', adm.email)
                .maybeSingle();

            if (!existing) {
                await supabase.from('admin_users').insert([adm]);
                console.log(`✅ Seeded admin user (${adm.email}) in Supabase.`);
            }
        }
    } catch (err) {
        console.warn('⚠️ Supabase admin seeding notice:', err.message);
    }
}

// Auto-seeding helper for Default Creators in Supabase
async function seedDefaultCreatorsInSupabase(seedCreators, seedTransactions) {
    if (!supabase) return;
    try {
        const { count, error } = await supabase.from('users').select('*', { count: 'exact', head: true });
        if (!error && (count === 0 || count === null)) {
            const creatorPassHash = CREATOR_SEED_PASSWORD ? bcrypt.hashSync(CREATOR_SEED_PASSWORD, BCRYPT_ROUNDS) : '';
            const creatorsToInsert = seedCreators.map(c => ({
                id: c.id,
                email: c.email,
                password_hash: creatorPassHash,
                name: c.name,
                plan_tier: c.plan_tier,
                status: c.status,
                created_at: c.created_at
            }));
            await supabase.from('users').insert(creatorsToInsert);
            if (seedTransactions && seedTransactions.length > 0) {
                await supabase.from('transactions').insert(seedTransactions);
            }
            console.log('✅ Seeded default creators and transactions in Supabase.');
        }
    } catch (err) {
        console.warn('⚠️ Supabase creator seeding notice:', err.message);
    }
}

// Ping Supabase for health check diagnostics
async function pingSupabase() {
    if (!supabase) {
        return { status: 'memory_fallback', latencyMs: 0 };
    }
    const start = Date.now();
    try {
        const { error } = await supabase.from('users').select('id', { head: true, count: 'exact' });
        const latencyMs = Date.now() - start;
        if (error) {
            return { status: 'degraded', latencyMs, error: error.message };
        }
        return { status: 'connected', latencyMs };
    } catch (err) {
        const latencyMs = Date.now() - start;
        return { status: 'disconnected', latencyMs, error: err.message };
    }
}

module.exports = {
    supabase,
    seedAdminAccountInSupabase,
    seedDefaultCreatorsInSupabase,
    pingSupabase
};
