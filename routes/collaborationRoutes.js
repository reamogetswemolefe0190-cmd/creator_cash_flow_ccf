'use strict';

const express = require('express');
const controller = require('../controllers/collaborationController');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.use(authenticateToken);
router.get('/workspace', controller.getWorkspace);
router.post('/organizations', controller.createOrganization);
router.post('/organizations/:organizationId/invitations', controller.inviteMember);
router.post('/campaigns', controller.createCampaign);
router.post('/campaigns/:campaignId/creators', controller.assignCreator);
router.post('/campaigns/:campaignId/accept', controller.acceptAssignment);
router.post('/campaigns/:campaignId/milestones', controller.createMilestone);
router.get('/campaigns/:campaignId/messages', controller.getMessages);
router.post('/campaigns/:campaignId/messages', controller.addMessage);

module.exports = router;
