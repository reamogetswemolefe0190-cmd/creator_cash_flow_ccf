// ==========================================================================
// Creator Cash Flow - Onboarding Responses Controller
// ==========================================================================

const { supabase } = require('../services/supabase');
const { memoryDb } = require('../services/memoryDb');

async function saveOnboarding(req, res) {
    try {
        const { creatorType, platforms, goal, connected, isManual } = req.body;

        if (supabase) {
            const { error } = await supabase.from('onboarding_responses').upsert({
                user_id: req.user.id,
                creator_type: creatorType,
                platforms,
                goal,
                connected,
                is_manual: isManual
            });
            if (error) throw error;
        } else {
            const existingIdx = memoryDb.onboarding.findIndex(o => o.user_id === req.user.id);
            const entry = { user_id: req.user.id, creatorType, platforms, goal, connected, isManual, updated_at: new Date() };
            if (existingIdx >= 0) {
                memoryDb.onboarding[existingIdx] = entry;
            } else {
                memoryDb.onboarding.push(entry);
            }
        }

        res.json({ success: true, message: 'Onboarding responses saved successfully.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to save onboarding responses.' });
    }
}

module.exports = {
    saveOnboarding
};
