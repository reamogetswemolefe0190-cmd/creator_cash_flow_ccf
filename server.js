// ==========================================================================
// Creator Cash Flow - Full-Stack REST API Backend Orchestrator
// Modular Architecture Refactoring (Decomposed into config/, services/,
// middleware/, controllers/, and routes/)
// ==========================================================================

const express = require('express');
const helmet = require('helmet');

// Configuration Modules
const {
    PORT,
    JWT_SECRET,
    MASTER_ADMIN_EMAIL: ADMIN_EMAIL
} = require('./config/env');
const { corsErrorHandler } = require('./config/cors');

// Service Modules
const { memoryDb } = require('./services/memoryDb');
const { maskPII, inferCategoryTag } = require('./services/geminiService');

// Middleware Modules
const {
    rateLimitAdminLogin,
    adminLoginAttempts,
    getClientIp
} = require('./middleware/rateLimiter');
const { requireAdmin } = require('./middleware/adminAuth');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

// Route Modules
const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const onboardingRoutes = require('./routes/onboardingRoutes');
const integrationRoutes = require('./routes/integrationRoutes');
const aiRoutes = require('./routes/aiRoutes');

// Express Application Initialization
const app = express();
app.set('trust proxy', 1);

// Security Headers & Whitelisted CORS
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                "'unsafe-inline'",          // inline JS in index.html / admin.html
                "https://cdn.jsdelivr.net",  // Chart.js, Lucide Icons
                "https://cdn.getphyllo.com", // Phyllo Connect SDK
                "https://unpkg.com",         // any unpkg CDN assets
                "https://cdn.tailwindcss.com" // Tailwind CSS Engine
            ],
            styleSrc: [
                "'self'",
                "'unsafe-inline'",           // inline styles & Tailwind
                "https://fonts.googleapis.com",
                "https://cdn.jsdelivr.net"
            ],
            fontSrc: [
                "'self'",
                "https://fonts.gstatic.com"
            ],
            imgSrc: [
                "'self'",
                "data:",                     // base64 embedded images
                "https://images.unsplash.com"
            ],
            connectSrc: [
                "'self'",
                "https://api.getphyllo.com",
                "https://api.staging.getphyllo.com",
                "https://generativelanguage.googleapis.com",
                "https://*.supabase.co",
                "https://api.resend.com"
            ],
            frameSrc:   ["'none'"],
            objectSrc:  ["'none'"],
            upgradeInsecureRequests: []
        }
    }
}));
app.use(corsErrorHandler);

// Body Parsing & Static Asset Serving
app.use(express.json());
app.use(express.static(__dirname));

// ==========================================================================
// API ROUTE MOUNTING & ENDPOINT DECLARATIONS
// ==========================================================================

// System Health & Deep Diagnostics (/api/health)
app.use('/api/health', healthRoutes);

// Creator Authentication Routes (/api/auth/signup, /api/auth/register, /api/auth/login)
app.use('/api/auth', authRoutes);

// Administrator Command Routes (/api/admin/auth/login, /api/admin/verify-auth,
// /api/admin/metrics, /api/admin/creators, /api/admin/creators/:id/status,
// /api/admin/audit-logs, /api/admin/telemetry)
// Enforces requireAdmin cryptographic JWT role check: role !== 'admin' -> HTTP 403 Forbidden
app.use('/api/admin', adminRoutes);

// Transactions & Cash Flow Ledger Routes (/api/transactions)
app.use('/api/transactions', transactionRoutes);

// Onboarding Responses Routes (/api/onboarding/save)
app.use('/api/onboarding', onboardingRoutes);

// Third-Party Integrations Routes (/api/integrations/phyllo/token)
app.use('/api/integrations', integrationRoutes);

// Gemini 1.5 Flash AI Query & Privacy Telemetry Proxy (/api/gemini)
app.use('/api/gemini', aiRoutes);

// 404 Route Not Found Envelope & Centralized Error Handler
app.use(notFoundHandler);
app.use(errorHandler);

// HTTP Server Initialization
let server = null;
if (require.main === module) {
    server = app.listen(PORT, () => {
        console.log(`⚡ Creator Cash Flow Secure Modular Backend API running on port ${PORT}`);
    });
}

// ==========================================================================
// BACKWARD COMPATIBILITY EXPORTS BRIDGE
// ==========================================================================
module.exports = {
    app,
    server,
    memoryDb,
    rateLimitAdminLogin,
    requireAdmin,
    adminLoginAttempts,
    JWT_SECRET,
    maskPII,
    inferCategoryTag,
    getClientIp
};
