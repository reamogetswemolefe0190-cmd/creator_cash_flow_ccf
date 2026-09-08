// ==========================================================================
// Creator Cash Flow - Centralized Environment & Security Configuration
// ==========================================================================

process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || '128';
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';
const isStressTest = process.env.NODE_ENV === 'test' || process.env.STRESS_TEST === 'true' || process.env.STRESS_TEST === '1';

const PORT = parseInt(process.env.PORT, 10) || 5000;

// Security & Cryptographic Secrets (Fail-fast in production)
const JWT_SECRET = process.env.JWT_SECRET || (isProduction
    ? (() => { throw new Error('JWT_SECRET environment variable is required in production'); })()
    : 'creator-cash-flow-jwt-dev-secret-key-2026');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || (isProduction
    ? (() => { throw new Error('ENCRYPTION_KEY environment variable is required in production'); })()
    : '0123456789abcdef0123456789abcdef'); // 32 bytes

const BCRYPT_ROUNDS = process.env.BCRYPT_ROUNDS ? parseInt(process.env.BCRYPT_ROUNDS, 10) : (isStressTest ? 1 : 10);

// Supabase Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

// Admin Configuration
const MASTER_ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@creatorcashflow.co.za';
const MASTER_ADMIN_PASS = process.env.ADMIN_PASSWORD || (isProduction ? '' : 'AdminMaster2026!');
const FALLBACK_ADMIN_EMAIL = process.env.FALLBACK_ADMIN_EMAIL || 'admin@creatorcashflow.com';
const FALLBACK_ADMIN_PASS = process.env.ADMIN_PASSWORD || (isProduction ? '' : 'AdminPass2026!');
const CREATOR_SEED_PASSWORD = process.env.CREATOR_SEED_PASSWORD || (isProduction ? '' : 'CreatorPass2026!');

// External Services
const PHYLLO_AUTH_HEADER = process.env.PHYLLO_AUTH_HEADER;
const PHYLLO_API_URL = process.env.PHYLLO_API_URL || 'https://api.staging.getphyllo.com';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_API_URL = process.env.RESEND_API_URL || 'https://api.resend.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'Creator Cash Flow <onboarding@resend.dev>';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta';

module.exports = {
    isProduction,
    isStressTest,
    PORT,
    JWT_SECRET,
    ENCRYPTION_KEY,
    BCRYPT_ROUNDS,
    SUPABASE_URL,
    SUPABASE_KEY,
    MASTER_ADMIN_EMAIL,
    MASTER_ADMIN_PASS,
    FALLBACK_ADMIN_EMAIL,
    FALLBACK_ADMIN_PASS,
    CREATOR_SEED_PASSWORD,
    PHYLLO_AUTH_HEADER,
    PHYLLO_API_URL,
    RESEND_API_KEY,
    RESEND_API_URL,
    FROM_EMAIL,
    GEMINI_API_KEY,
    GEMINI_API_URL
};
