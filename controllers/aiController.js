// ==========================================================================
// Creator Cash Flow - Gemini AI Proxy & Telemetry Controller
// ==========================================================================

const crypto = require('crypto');
const {
    maskPII,
    inferCategoryTag,
    generateContent
} = require('../services/geminiService');
const { supabase } = require('../services/supabase');
const { appendAiTelemetry } = require('../services/memoryDb');

async function handleGemini(req, res) {
    const startTime = Date.now();
    const { prompt, systemContext } = req.body || {};

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({
            success: false,
            error: 'Missing or invalid prompt in request body.',
            code: 'INVALID_PROMPT'
        });
    }

    const categoryTag = inferCategoryTag(prompt);
    const maskedPrompt = maskPII(prompt);

    let aiResult = null;
    let aiError = null;
    let tokensUsed = 0;
    let aiText = '';

    try {
        aiResult = await generateContent({ prompt, systemContext });
        tokensUsed = aiResult.tokensUsed;
        aiText = aiResult.text;
    } catch (err) {
        aiError = err;
        aiText = err.message || 'AI generation failed';
        tokensUsed = Math.ceil(((prompt || '').length + (aiText || '').length) / 4);
    }

    const latencyMs = Date.now() - startTime;

    const telemetryRecord = {
        id: 'tel_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'),
        category_tag: categoryTag,
        prompt_masked: maskedPrompt,
        tokens_used: tokensUsed,
        model: 'gemini-1.5-flash',
        latency_ms: latencyMs,
        created_at: new Date().toISOString()
    };

    if (supabase) {
        try {
            await supabase.from('ai_telemetry').insert([telemetryRecord]);
        } catch (tErr) {
            console.warn('⚠️ Supabase telemetry insert notice:', tErr.message);
        }
    }
    appendAiTelemetry(telemetryRecord);

    if (aiError) {
        const statusCode = aiError.statusCode || aiError.status || 500;
        return res.status(statusCode).json({
            success: false,
            error: aiError.message,
            code: aiError.code || 'AI_SERVICE_ERROR',
            fallback: true
        });
    }

    return res.status(200).json({
        success: true,
        text: aiResult.text,
        source: 'Gemini 1.5 Flash (Backend API)',
        categoryTag: categoryTag,
        tokensUsed: tokensUsed
    });
}

module.exports = {
    handleGemini
};
