'use strict';
const { supabase } = require('./supabase');
const { InstagramError } = require('./metaInstagram');
function createInstagramRepository(db = supabase) {
    async function result(query) {
        const { data, error } = await query;
        if (error) throw new InstagramError('INSTAGRAM_STORAGE_UNAVAILABLE', 503);
        return data;
    }
    return {
        available: Boolean(db && process.env.SUPABASE_SERVICE_ROLE_KEY),
        async start(row) {
            await result(db.from('instagram_oauth_attempts').delete().eq('user_id', row.user_id).lt('expires_at', new Date().toISOString()));
            await result(db.from('instagram_oauth_attempts').insert(row));
        },
        async consume(stateHash, cookieHash) {
            const rows = await result(db.from('instagram_oauth_attempts').update({ status: 'processing' }).eq('state_hash', stateHash).eq('cookie_hash', cookieHash).eq('status', 'pending').gt('expires_at', new Date().toISOString()).select('user_id'));
            return rows?.[0];
        },
        finish: (stateHash, status, code) => result(db.from('instagram_oauth_attempts').update({ status, result_code: code }).eq('state_hash', stateHash)),
        async attempt(stateHash, userId) {
            return result(db.from('instagram_oauth_attempts').select('status,result_code,expires_at').eq('state_hash', stateHash).eq('user_id', userId).maybeSingle());
        },
        save: rows => result(db.from('instagram_connections').upsert(rows, { onConflict: 'user_id,instagram_id' })),
        list: userId => result(db.from('instagram_connections').select('instagram_id,username,page_id,expires_at,connected_at').eq('user_id', userId)),
        get: (userId, id) => result(db.from('instagram_connections').select('*').eq('user_id', userId).eq('instagram_id', id).maybeSingle()),
        remove: (userId, id) => result(db.from('instagram_connections').delete().eq('user_id', userId).eq('instagram_id', id)),
        revokeMeta: metaUserId => result(db.from('instagram_connections').delete().eq('meta_user_id', metaUserId)),
        receipt: code => result(db.from('instagram_deletion_receipts').insert({ code })),
        getReceipt: code => result(db.from('instagram_deletion_receipts').select('code').eq('code', code).maybeSingle())
    };
}
module.exports = { createInstagramRepository };
