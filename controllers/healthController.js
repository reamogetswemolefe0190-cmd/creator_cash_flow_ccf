// ==========================================================================
// Creator Cash Flow - Deep Diagnostics Health Controller
// Checks database connectivity, process memory, uptime & external services
// ==========================================================================

const { supabase, pingSupabase } = require('../services/supabase');
const { memoryDb } = require('../services/memoryDb');
const { adminLoginAttempts } = require('../middleware/rateLimiter');
const {
    GEMINI_API_KEY,
    PHYLLO_AUTH_HEADER,
    RESEND_API_KEY
} = require('../config/env');

async function getHealth(req, res) {
    const mem = process.memoryUsage();
    const dbPing = await pingSupabase();

    const isHealthy = dbPing.status === 'connected' || dbPing.status === 'memory_fallback';

    const healthReport = {
        name: "Creator Cash Flow API Engine",
        status: isHealthy ? "active" : "degraded",
        state: isHealthy ? "healthy" : "degraded",
        version: "3.0.0",
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        database: supabase ? "Supabase Cloud PostgreSQL" : "Memory Backup",
        databaseDetails: {
            provider: supabase ? "Supabase Cloud PostgreSQL" : "Memory Backup",
            status: dbPing.status,
            latencyMs: dbPing.latencyMs,
            ...(dbPing.error ? { error: dbPing.error } : {})
        },
        memory: {
            heapUsedMB: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
            heapTotalMB: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
            rssMB: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
            externalMB: Math.round((mem.external / 1024 / 1024) * 100) / 100
        },
        inMemoryStores: {
            rateLimitTrackedIps: adminLoginAttempts.size,
            auditLogsCount: (memoryDb.audit_logs || []).length,
            telemetryCount: (memoryDb.ai_telemetry || []).length
        },
        integrations: {
            gemini: {
                configured: !!GEMINI_API_KEY,
                model: 'gemini-1.5-flash'
            },
            phyllo: {
                configured: !!PHYLLO_AUTH_HEADER
            },
            resend: {
                configured: !!RESEND_API_KEY
            }
        },
        security: "AES-256-CBC + JWT",
        documentation: "https://creatorcashflow.co.za/"
    };

    const httpStatus = isHealthy ? 200 : 503;
    return res.status(httpStatus).json(healthReport);
}

module.exports = {
    getHealth
};
