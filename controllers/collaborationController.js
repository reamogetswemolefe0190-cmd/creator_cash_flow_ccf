'use strict';

const crypto = require('crypto');
const { supabase } = require('../services/supabase');
const { memoryDb, findUserByEmail } = require('../services/memoryDb');
const { sanitizeString } = require('../middleware/validation');

const id = prefix => `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
const clean = (value, max = 160) => sanitizeString(String(value || '')).slice(0, max);
const isProdUnavailable = res => process.env.NODE_ENV === 'production' && !supabase
    ? (res.status(503).json({ error: 'Campaign collaboration is temporarily unavailable.' }), true)
    : false;

async function insert(table, row) {
    if (!supabase) { memoryDb[table].push(row); return row; }
    const { data, error } = await supabase.from(table).insert([row]).select().single();
    if (error) throw error;
    return data;
}

async function membership(orgId, userId) {
    if (!supabase) return memoryDb.organization_members.find(m => m.organization_id === orgId && m.user_id === userId && m.status === 'active');
    const { data } = await supabase.from('organization_members').select('*').eq('organization_id', orgId).eq('user_id', userId).eq('status', 'active').maybeSingle();
    return data;
}

async function campaignById(campaignId) {
    if (!supabase) return memoryDb.campaigns.find(c => c.id === campaignId);
    const { data } = await supabase.from('campaigns').select('*').eq('id', campaignId).maybeSingle();
    return data;
}

async function requireManager(req, res, orgId) {
    const member = await membership(orgId, req.user.id);
    if (!member || !['owner', 'manager'].includes(member.role)) {
        res.status(403).json({ error: 'Agency or brand manager access is required.' });
        return null;
    }
    return member;
}

async function createOrganization(req, res) {
    if (isProdUnavailable(res)) return;
    try {
        const name = clean(req.body?.name, 120);
        const type = clean(req.body?.type, 20).toLowerCase();
        if (name.length < 2 || !['agency', 'brand'].includes(type)) return res.status(400).json({ error: 'A valid organisation name and type are required.' });
        const organization = await insert('organizations', { id: id('org'), name, type, created_by: req.user.id, created_at: new Date().toISOString() });
        await insert('organization_members', { organization_id: organization.id, user_id: req.user.id, role: 'owner', status: 'active', created_at: new Date().toISOString() });
        return res.status(201).json({ organization });
    } catch (error) {
        console.error('[CREATE ORGANIZATION]', error.message);
        return res.status(503).json({ error: 'The organisation could not be created. Confirm the collaboration database migration is installed.' });
    }
}

async function inviteMember(req, res) {
    if (isProdUnavailable(res)) return;
    try {
        if (!await requireManager(req, res, req.params.organizationId)) return;
        const email = clean(req.body?.email, 254).toLowerCase();
        const role = clean(req.body?.role, 20).toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !['manager', 'analyst', 'creator', 'brand_viewer'].includes(role)) return res.status(400).json({ error: 'A valid email and invitation role are required.' });
        const invitation = await insert('organization_invitations', { id: id('inv'), organization_id: req.params.organizationId, email, role, invited_by: req.user.id, status: 'pending', expires_at: new Date(Date.now() + 7 * 86400000).toISOString(), accepted_by: null, created_at: new Date().toISOString() });
        return res.status(201).json({ invitation, delivery: 'pending_email_integration' });
    } catch (error) {
        console.error('[INVITE MEMBER]', error.message);
        return res.status(503).json({ error: 'The invitation could not be created.' });
    }
}

async function createCampaign(req, res) {
    if (isProdUnavailable(res)) return;
    try {
        const organizationId = clean(req.body?.organizationId, 100);
        if (!await requireManager(req, res, organizationId)) return;
        const name = clean(req.body?.name, 160);
        if (name.length < 2) return res.status(400).json({ error: 'Campaign name is required.' });
        const campaign = await insert('campaigns', { id: id('cmp'), organization_id: organizationId, brand_organization_id: req.body?.brandOrganizationId || null, name, brief: clean(req.body?.brief, 4000), status: 'draft', starts_on: req.body?.startsOn || null, ends_on: req.body?.endsOn || null, currency: 'ZAR', fixed_fee: Math.max(0, Number(req.body?.fixedFee || 0)), created_by: req.user.id, created_at: new Date().toISOString() });
        return res.status(201).json({ campaign });
    } catch (error) {
        console.error('[CREATE CAMPAIGN]', error.message);
        return res.status(503).json({ error: 'The campaign could not be created.' });
    }
}

async function assignCreator(req, res) {
    if (isProdUnavailable(res)) return;
    try {
        const campaign = await campaignById(req.params.campaignId);
        if (!campaign) return res.status(404).json({ error: 'Campaign not found.' });
        if (!await requireManager(req, res, campaign.organization_id)) return;
        const email = clean(req.body?.email, 254).toLowerCase();
        let creator = null;
        if (supabase) {
            const result = await supabase.from('users').select('id,email,name').eq('email', email).maybeSingle();
            creator = result.data;
        } else creator = findUserByEmail(email);
        if (!creator) return res.status(404).json({ error: 'The creator must create an account before being assigned.' });
        const assignment = await insert('campaign_creators', { campaign_id: campaign.id, creator_user_id: creator.id, assigned_by: req.user.id, consent_status: 'invited', consented_at: null, data_scope: { identity: true, engagement: true, audience: false, income: false }, created_at: new Date().toISOString() });
        return res.status(201).json({ assignment, creator: { id: creator.id, name: creator.name, email: creator.email } });
    } catch (error) {
        if (String(error.message).includes('duplicate')) return res.status(409).json({ error: 'This creator is already assigned.' });
        console.error('[ASSIGN CREATOR]', error.message);
        return res.status(503).json({ error: 'The creator could not be assigned.' });
    }
}

async function acceptAssignment(req, res) {
    if (isProdUnavailable(res)) return;
    const campaignId = req.params.campaignId;
    const scope = { identity: true, engagement: true, audience: Boolean(req.body?.audience), income: false };
    if (!supabase) {
        const assignment = memoryDb.campaign_creators.find(a => a.campaign_id === campaignId && a.creator_user_id === req.user.id);
        if (!assignment) return res.status(404).json({ error: 'Campaign invitation not found.' });
        Object.assign(assignment, { consent_status: 'accepted', consented_at: new Date().toISOString(), data_scope: scope });
        return res.json({ assignment });
    }
    const { data, error } = await supabase.from('campaign_creators').update({ consent_status: 'accepted', consented_at: new Date().toISOString(), data_scope: scope }).eq('campaign_id', campaignId).eq('creator_user_id', req.user.id).eq('consent_status', 'invited').select().maybeSingle();
    if (error) return res.status(503).json({ error: 'The campaign invitation could not be accepted.' });
    if (!data) return res.status(404).json({ error: 'Campaign invitation not found.' });
    return res.json({ assignment: data });
}

async function createMilestone(req, res) {
    if (isProdUnavailable(res)) return;
    try {
        const campaign = await campaignById(req.params.campaignId);
        if (!campaign) return res.status(404).json({ error: 'Campaign not found.' });
        if (!await requireManager(req, res, campaign.organization_id)) return;
        const target = Number(req.body?.targetValue);
        if (!Number.isFinite(target) || target <= 0) return res.status(400).json({ error: 'A positive milestone target is required.' });
        const milestone = await insert('campaign_milestones', { id: id('mil'), campaign_id: campaign.id, name: clean(req.body?.name, 160), metric_name: clean(req.body?.metricName, 80), target_value: target, bonus_amount: Math.max(0, Number(req.body?.bonusAmount || 0)), status: 'tracking', reached_at: null, verification_ends_at: null, approved_by: null, approved_at: null, created_at: new Date().toISOString() });
        return res.status(201).json({ milestone });
    } catch (error) {
        console.error('[CREATE MILESTONE]', error.message);
        return res.status(503).json({ error: 'The milestone could not be created.' });
    }
}

async function getWorkspace(req, res) {
    if (isProdUnavailable(res)) return;
    if (!supabase) {
        const memberships = memoryDb.organization_members.filter(m => m.user_id === req.user.id);
        const orgIds = memberships.map(m => m.organization_id);
        const assignments = memoryDb.campaign_creators.filter(a => a.creator_user_id === req.user.id);
        const campaignIds = assignments.map(a => a.campaign_id);
        return res.json({ organizations: memoryDb.organizations.filter(o => orgIds.includes(o.id)), memberships, campaigns: memoryDb.campaigns.filter(c => orgIds.includes(c.organization_id) || campaignIds.includes(c.id)), assignments });
    }
    try {
        const memberResult = await supabase.from('organization_members').select('*').eq('user_id', req.user.id);
        const assignmentResult = await supabase.from('campaign_creators').select('*').eq('creator_user_id', req.user.id);
        if (memberResult.error || assignmentResult.error) throw memberResult.error || assignmentResult.error;
        const orgIds = memberResult.data.map(m => m.organization_id);
        const campaignIds = assignmentResult.data.map(a => a.campaign_id);
        const orgResult = orgIds.length ? await supabase.from('organizations').select('*').in('id', orgIds) : { data: [] };
        const ownedCampaigns = orgIds.length ? await supabase.from('campaigns').select('*').in('organization_id', orgIds) : { data: [] };
        const assignedCampaigns = campaignIds.length ? await supabase.from('campaigns').select('*').in('id', campaignIds) : { data: [] };
        const merged = [...(ownedCampaigns.data || []), ...(assignedCampaigns.data || [])].filter((c, index, all) => all.findIndex(x => x.id === c.id) === index);
        return res.json({ organizations: orgResult.data || [], memberships: memberResult.data, campaigns: merged, assignments: assignmentResult.data });
    } catch (error) {
        return res.status(503).json({ error: 'Workspace data is unavailable. Confirm the collaboration database migration is installed.' });
    }
}

module.exports = { createOrganization, inviteMember, createCampaign, assignCreator, acceptAssignment, createMilestone, getWorkspace };
