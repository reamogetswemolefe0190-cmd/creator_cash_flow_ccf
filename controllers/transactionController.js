// ==========================================================================
// Creator Cash Flow - Transactions & Cash Flow Ledger Controller
// ==========================================================================

const { supabase } = require('../services/supabase');
const { memoryDb } = require('../services/memoryDb');

async function getTransactions(req, res) {
    if (process.env.NODE_ENV === 'production' && !supabase) {
        return res.status(503).json({ error: 'Your records are temporarily unavailable. Please try again later.' });
    }
    try {
        if (supabase) {
            try {
                const { data, error } = await supabase
                    .from('transactions')
                    .select('*')
                    .eq('user_id', req.user.id)
                    .order('created_at', { ascending: false });

                if (!error && data) {
                    const formatted = data.map(t => ({
                        id: t.id,
                        date: t.date,
                        source: t.source,
                        merchant: t.merchant,
                        type: t.type,
                        category: t.category,
                        taxStatus: t.tax_status || t.taxStatus,
                        amount: parseFloat(t.amount)
                    }));

                    return res.json({ transactions: formatted });
                }
                if (process.env.NODE_ENV === 'production') {
                    return res.status(503).json({ error: 'Your records are temporarily unavailable. Please try again later.' });
                }
                console.warn('⚠️ Supabase transactions query error, falling back to memoryDb:', error?.message);
            } catch (sErr) {
                if (process.env.NODE_ENV === 'production') {
                    return res.status(503).json({ error: 'Your records are temporarily unavailable. Please try again later.' });
                }
                console.warn('⚠️ Supabase transactions query exception, falling back to memoryDb:', sErr.message);
            }
        }

        // MemoryDb Fallback
        const indexedTxs = memoryDb.transactionsByUserId[req.user.id] || [];
        return res.json({ transactions: indexedTxs });
    } catch (err) {
        console.error('[GET TRANSACTIONS ERROR]', err);
        return res.status(500).json({ error: 'Failed to retrieve ledger data.' });
    }
}

async function createTransaction(req, res) {
    if (process.env.NODE_ENV === 'production' && !supabase) {
        return res.status(503).json({ error: 'Saving records is temporarily unavailable. Please try again later.' });
    }
    try {
        const { source, merchant, type, category, amount, date } = req.body;
        const txId = 'tx_' + Date.now();
        const txDate = date || new Date().toLocaleString('en-US', { month: 'short', day: 'numeric' });

        const newTx = {
            id: txId,
            user_id: req.user.id,
            date: txDate,
            source,
            merchant,
            type,
            category: category || (type === 'income' ? 'Creator Revenue' : 'Operating Expense'),
            tax_status: type === 'income' ? 'Taxable Income' : '100% Tax Write-Off',
            amount: parseFloat(amount)
        };

        if (supabase) {
            try {
                const { error } = await supabase.from('transactions').insert([newTx]);
                if (error) throw error;
            } catch (sErr) {
                if (process.env.NODE_ENV === 'production') {
                    return res.status(503).json({ error: 'Your transaction could not be saved. Please try again later.' });
                }
                console.warn('⚠️ Supabase transaction insert notice, using memoryDb fallback:', sErr.message);
            }
        }

        // Dual-write to memoryDb so fallback reads are synchronized
        if (!memoryDb.transactionsByUserId[req.user.id]) {
            memoryDb.transactionsByUserId[req.user.id] = [];
        }
        if (!memoryDb.transactionIdsSet.has(newTx.id)) {
            memoryDb.transactions.push(newTx);
            memoryDb.transactionsByUserId[req.user.id].push(newTx);
            memoryDb.transactionIdsSet.add(newTx.id);
        }

        res.status(201).json({
            success: true,
            message: 'Transaction saved successfully.',
            transaction: {
                id: newTx.id,
                date: newTx.date,
                source: newTx.source,
                merchant: newTx.merchant,
                type: newTx.type,
                category: newTx.category,
                taxStatus: newTx.tax_status,
                amount: newTx.amount
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Failed to save transaction.', code: 'TRANSACTION_ERROR' });
    }
}

module.exports = {
    getTransactions,
    createTransaction
};
