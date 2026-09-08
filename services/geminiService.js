// ==========================================================================
// Creator Cash Flow - Unified Gemini AI Service Module
// Encapsulates PII masking, intent categorization, and upstream API dispatch
// ==========================================================================

const GEMINI_API_URL = process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Masks sensitive PII (emails, phone numbers, and ZAR financial amounts)
 * @param {string} text - Raw input prompt or text
 * @returns {string} - Masked text with privacy redactions applied
 */
function maskPII(text) {
    if (!text || typeof text !== 'string') return '';
    let masked = text;

    // 1. Email Masking
    masked = masked.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]');

    // 2. Phone Number Masking (SA & Int'l formats, 7-15 digits)
    masked = masked.replace(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}\b/g, (match) => {
        const digitsOnly = match.replace(/\D/g, '');
        if (digitsOnly.length >= 7 && digitsOnly.length <= 15) {
            return '[REDACTED_PHONE]';
        }
        return match;
    });

    // 3. ZAR Currency Masking (handles R1,500, R1500, ZAR 5000, R500, R1 500, R500.00, ZAR 5,000, 5000 ZAR, etc.)
    masked = masked.replace(/(?:ZAR|R)\s?\d{1,3}(?:[,\s]\d{3})*(?:\.\d{2})?\b|\b(?:ZAR|R)\s?\d+(?:\.\d{2})?\b/gi, '[REDACTED_ZAR]');
    masked = masked.replace(/\b\d+(?:[,\s]\d{3})*(?:\.\d{2})?\s*ZAR\b/gi, '[REDACTED_ZAR]');

    return masked;
}

/**
 * Classifies creator financial query into standard category tags
 * @param {string} text - User prompt
 * @returns {string} - Inferred category tag
 */
function inferCategoryTag(text) {
    if (!text || typeof text !== 'string') return 'General Inquiry';
    const lower = text.toLowerCase();
    if (lower.includes('tax') || lower.includes('deduction') || lower.includes('sars') || lower.includes('reserve') || lower.includes('write-off')) {
        return 'Tax Deduction Strategy';
    }
    if (lower.includes('gear') || lower.includes('camera') || lower.includes('lens') || lower.includes('equipment') || lower.includes('hardware') || lower.includes('purchase') || lower.includes('buy')) {
        return 'Gear Purchase Planning';
    }
    if (lower.includes('revenue') || lower.includes('youtube') || lower.includes('tiktok') || lower.includes('patreon') || lower.includes('adsense') || lower.includes('sponsor') || lower.includes('income') || lower.includes('brand')) {
        return 'Revenue Optimization';
    }
    return 'General Inquiry';
}

/**
 * Dispatches prompt to Google Gemini 1.5 Flash API
 * @param {object} options - { prompt, systemContext }
 * @returns {Promise<{ text: string, tokensUsed: number, model: string, source: string }>}
 */
async function generateContent({ prompt, systemContext }) {
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        const err = new Error('Missing or invalid prompt in request body.');
        err.statusCode = 400;
        err.code = 'INVALID_PROMPT';
        throw err;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        const err = new Error('Gemini API key not configured on server.');
        err.statusCode = 503;
        err.code = 'AI_NOT_CONFIGURED';
        throw err;
    }

    const defaultSystemContext = systemContext || 'You are CCF Creator Intelligence, an expert financial advisor for modern creators. Provide concise, highly actionable 2-3 sentence financial guidance answering the user prompt directly.';

    let response;
    try {
        response = await fetch(`${GEMINI_API_URL}/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: defaultSystemContext },
                        { text: prompt.trim() }
                    ]
                }]
            })
        });
    } catch (networkErr) {
        const err = new Error(`Gemini upstream connection failed: ${networkErr.message}`);
        err.statusCode = 502;
        err.code = 'AI_CONNECTION_ERROR';
        throw err;
    }

    if (!response.ok) {
        let errDetails = '';
        try {
            const errJson = await response.json();
            errDetails = errJson.error?.message || response.statusText;
        } catch (_) {
            errDetails = response.statusText || String(response.status);
        }
        const err = new Error(`Gemini upstream API responded with status ${response.status}: ${errDetails}`);
        err.statusCode = response.status >= 500 ? response.status : 502;
        err.code = 'AI_UPSTREAM_ERROR';
        throw err;
    }

    let data;
    try {
        data = await response.json();
    } catch (parseErr) {
        const err = new Error('Failed to parse Gemini API JSON response.');
        err.statusCode = 502;
        err.code = 'AI_PARSE_ERROR';
        throw err;
    }

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0] || !data.candidates[0].content.parts[0].text) {
        const err = new Error('Unexpected Gemini API response structure.');
        err.statusCode = 502;
        err.code = 'AI_MALFORMED_RESPONSE';
        throw err;
    }

    const text = data.candidates[0].content.parts[0].text;
    const tokensUsed = data.usageMetadata?.totalTokenCount || Math.ceil(((prompt || '').length + (text || '').length) / 4);

    return {
        text,
        tokensUsed,
        model: 'gemini-1.5-flash',
        source: 'Gemini 1.5 Flash'
    };
}

module.exports = {
    maskPII,
    inferCategoryTag,
    generateContent
};
