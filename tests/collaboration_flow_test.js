'use strict';

process.env.NODE_ENV = 'test';
process.env.PORT = '5058';
const assert = require('assert');
const { app } = require('../server');
const server = app.listen(5058, '127.0.0.1');

async function request(path, token, body) {
    const response = await fetch(`http://127.0.0.1:5058${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: response.status, body: await response.json() };
}

async function signup(name, email) {
    const result = await request('/api/auth/signup', null, { name, email, password: 'Valid-test-password-42' });
    assert.equal(result.status, 201);
    return result.body;
}

(async () => {
    const stamp = Date.now();
    const manager = await signup('Agency Manager', `manager-${stamp}@example.com`);
    const creator = await signup('Campaign Creator', `creator-${stamp}@example.com`);

    const organizationResult = await request('/api/collaboration/organizations', manager.token, { name: 'Studio North', type: 'agency' });
    assert.equal(organizationResult.status, 201);
    const organization = organizationResult.body.organization;

    const invite = await request(`/api/collaboration/organizations/${organization.id}/invitations`, manager.token, { email: `creator-${stamp}@example.com`, role: 'creator' });
    assert.equal(invite.status, 201);
    assert.equal(invite.body.invitation.status, 'pending');

    const campaignResult = await request('/api/collaboration/campaigns', manager.token, { organizationId: organization.id, name: 'Vela Summer Launch', brief: 'Two Reels and three Stories', fixedFee: 20000 });
    assert.equal(campaignResult.status, 201);
    const campaign = campaignResult.body.campaign;

    const assignmentResult = await request(`/api/collaboration/campaigns/${campaign.id}/creators`, manager.token, { email: `creator-${stamp}@example.com` });
    assert.equal(assignmentResult.status, 201);
    assert.equal(assignmentResult.body.assignment.data_scope.income, false);

    const creatorWorkspace = await request('/api/collaboration/workspace', creator.token);
    assert.equal(creatorWorkspace.status, 200);
    assert.equal(creatorWorkspace.body.assignments.length, 1);

    const acceptance = await request(`/api/collaboration/campaigns/${campaign.id}/accept`, creator.token, { audience: true });
    assert.equal(acceptance.status, 200);
    assert.equal(acceptance.body.assignment.consent_status, 'accepted');
    assert.equal(acceptance.body.assignment.data_scope.income, false);

    const milestone = await request(`/api/collaboration/campaigns/${campaign.id}/milestones`, manager.token, { name: '250k verified views', metricName: 'views', targetValue: 250000, bonusAmount: 5000 });
    assert.equal(milestone.status, 201);
    assert.equal(milestone.body.milestone.status, 'tracking');

    const forbidden = await request('/api/collaboration/campaigns', creator.token, { organizationId: organization.id, name: 'Not allowed' });
    assert.equal(forbidden.status, 403);

    console.log('COLLABORATION_FLOW_RESULTS', JSON.stringify({ passed: 16, failed: 0 }));
    server.close();
})().catch(error => {
    console.error(error);
    server.close(() => process.exit(1));
});
