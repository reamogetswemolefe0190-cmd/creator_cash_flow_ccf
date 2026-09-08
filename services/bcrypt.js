// ==========================================================================
// Creator Cash Flow - Bcrypt Abstraction (Real / Stress-Test Mock Switcher)
// ==========================================================================

const realBcrypt = require('bcryptjs');
const { isStressTest } = require('../config/env');

const bcrypt = isStressTest ? {
    hash: async (password, rounds) => `mock_hash_${password}`,
    hashSync: (password, rounds) => `mock_hash_${password}`,
    compare: async (password, hash) => {
        if (!hash || hash.startsWith('mock_hash_')) {
            return hash === `mock_hash_${password}`;
        }
        try {
            return await realBcrypt.compare(password, hash);
        } catch (_) {
            return false;
        }
    },
    compareSync: (password, hash) => {
        if (!hash || hash.startsWith('mock_hash_')) {
            return hash === `mock_hash_${password}`;
        }
        try {
            return realBcrypt.compareSync(password, hash);
        } catch (_) {
            return false;
        }
    }
} : realBcrypt;

module.exports = bcrypt;
