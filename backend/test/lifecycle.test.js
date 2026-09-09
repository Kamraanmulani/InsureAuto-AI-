require('dotenv').config();
const assert = require('assert');
const axios = require('axios');
const mongoose = require('mongoose');
const Claim = require('../src/models/Claim');
const { CLAIM_STATUS, ALLOWED_TRANSITIONS } = require('../src/models/Claim');

const API_URL = process.env.TEST_API_URL || 'http://localhost:5000/api';
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/insurance_claims';

const runLifecycleTests = async () => {
  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}`);
      console.error(err.message, err.response?.data);
      failed++;
    }
  };

  let assessorToken = '';
  let assessorUser = null;
  await test('Authenticate assessor to obtain Bearer token', async () => {
    const res = await axios.post(`${API_URL}/auth/login`, {
      email: 'assessor@insureauto.ai',
      password: 'Password@123'
    });
    assert.strictEqual(res.status, 200);
    assessorToken = res.data.token;
    assessorUser = res.data.user;
  });

  const authHeader = {
    headers: { Authorization: `Bearer ${assessorToken}` }
  };

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(MONGO_URI);
  }

  await test('Model: Schema defines separate concepts and default values', async () => {
    const schemaClaim = new Claim({
      claimId: `CLM-SCHEMA-${Date.now()}`,
      jobId: `job-schema-${Date.now()}`,
      incident: {
        date: '2026-09-09',
        time: '08:45 AM',
        location: 'Main St & 4th Ave',
        incidentType: 'Rear-end',
        description: 'Vehicle halted at traffic light when struck.'
      },
      customer: {
        customerId: 'CUST-8812',
        name: 'Alexander Cross',
        email: 'a.cross@example.com',
        phone: '+1 555-0144'
      },
      policy: {
        policyNumber: 'POL-MOTOR-9921',
        policyType: 'Comprehensive Motor',
        coverageType: 'Full Collision',
        deductible: '$250'
      },
      vehicle: {
        registration: '7XYZ890',
        make: 'Honda',
        model: 'Accord',
        year: 2024
      },
      evidence: [{
        type: 'PHOTO',
        fileReference: 'uploads/damage_rear_bumper.jpg',
        originalName: 'damage_rear_bumper.jpg',
        processingStatus: 'COMPLETED',
        metadata: { width: 1920, height: 1080 },
        analysisResults: { damageDetected: true }
      }],
      aiAssessment: {
        damageAssessment: { severity: 'MODERATE', score: 5.2 },
        fraudAssessment: { overallScore: 1.1, riskLevel: 'LOW' },
        consistencyAssessment: { score: 9.2, isConsistent: true },
        recommendation: 'APPROVE',
        confidence: 'HIGH',
        scores: { damage: 5.2, fraud: 1.1, consistency: 9.2 }
      }
    });

    await schemaClaim.save();

    assert.ok(schemaClaim._id);
    assert.strictEqual(schemaClaim.status, CLAIM_STATUS.SUBMITTED);
    assert.strictEqual(schemaClaim.customer.name, 'Alexander Cross');
    assert.strictEqual(schemaClaim.policy.policyNumber, 'POL-MOTOR-9921');
    assert.strictEqual(schemaClaim.vehicle.registration, '7XYZ890');
    assert.strictEqual(schemaClaim.incident.incidentType, 'Rear-end');
    assert.strictEqual(schemaClaim.evidence.length, 1);
    assert.strictEqual(schemaClaim.evidence[0].processingStatus, 'COMPLETED');
    assert.strictEqual(schemaClaim.aiAssessment.recommendation, 'APPROVE');
    assert.strictEqual(schemaClaim.decision.outcome, 'PENDING');
  });

  await test('Model: canTransitionTo enforces lifecycle state matrix', async () => {
    const claim = new Claim({
      claimId: `CLM-STATE-TEST-${Date.now()}`,
      jobId: `job-state-${Date.now()}`,
      status: CLAIM_STATUS.SUBMITTED,
      incident: { date: '2026-09-09', description: 'Test' }
    });

    assert.strictEqual(claim.canTransitionTo('PROCESSING'), true);
    assert.strictEqual(claim.canTransitionTo('CLOSED'), true);
    assert.strictEqual(claim.canTransitionTo('APPROVED'), false);
    assert.strictEqual(claim.canTransitionTo('UNDER_REVIEW'), false);
    assert.strictEqual(claim.canTransitionTo('AI_ASSESSED'), false);

    claim.status = CLAIM_STATUS.PROCESSING;
    assert.strictEqual(claim.canTransitionTo('AI_ASSESSED'), true);
    assert.strictEqual(claim.canTransitionTo('PENDING_REVIEW'), true);
    assert.strictEqual(claim.canTransitionTo('APPROVED'), false);

    claim.status = CLAIM_STATUS.AI_ASSESSED;
    assert.strictEqual(claim.canTransitionTo('PENDING_REVIEW'), true);
    assert.strictEqual(claim.canTransitionTo('APPROVED'), false);

    claim.status = CLAIM_STATUS.PENDING_REVIEW;
    assert.strictEqual(claim.canTransitionTo('UNDER_REVIEW'), true);
    assert.strictEqual(claim.canTransitionTo('NEEDS_INFORMATION'), true);
    assert.strictEqual(claim.canTransitionTo('APPROVED'), false);
    assert.strictEqual(claim.canTransitionTo('REJECTED'), false);

    claim.status = CLAIM_STATUS.UNDER_REVIEW;
    assert.strictEqual(claim.canTransitionTo('APPROVED'), true);
    assert.strictEqual(claim.canTransitionTo('REJECTED'), true);
    assert.strictEqual(claim.canTransitionTo('NEEDS_INFORMATION'), true);
    assert.strictEqual(claim.canTransitionTo('CLOSED'), true);
    assert.strictEqual(claim.canTransitionTo('SUBMITTED'), false);

    claim.status = CLAIM_STATUS.NEEDS_INFORMATION;
    assert.strictEqual(claim.canTransitionTo('UNDER_REVIEW'), true);
    assert.strictEqual(claim.canTransitionTo('PENDING_REVIEW'), true);
    assert.strictEqual(claim.canTransitionTo('APPROVED'), false);

    claim.status = CLAIM_STATUS.APPROVED;
    assert.strictEqual(claim.canTransitionTo('CLOSED'), true);
    assert.strictEqual(claim.canTransitionTo('UNDER_REVIEW'), false);

    claim.status = CLAIM_STATUS.CLOSED;
    assert.strictEqual(claim.canTransitionTo('UNDER_REVIEW'), false);
    assert.strictEqual(claim.canTransitionTo('APPROVED'), false);
    assert.strictEqual(claim.canTransitionTo('SUBMITTED'), false);
  });

  await test('Model: Pre-save hook rejects direct invalid status modification', async () => {
    const claim = new Claim({
      claimId: `CLM-HOOK-${Date.now()}`,
      jobId: `job-hook-${Date.now()}`,
      status: CLAIM_STATUS.SUBMITTED,
      incident: { date: '2026-09-09', description: 'Hook test' }
    });
    await claim.save();

    const loaded = await Claim.findById(claim._id);
    loaded.status = CLAIM_STATUS.APPROVED;

    let threw = false;
    try {
      await loaded.save();
    } catch (err) {
      threw = true;
      assert.ok(err.message.includes('Invalid lifecycle state transition'));
    }
    assert.strictEqual(threw, true);
  });

  await test('AI recommendation decoupled from claim status', async () => {
    const decouplingJobId = `CLM-DECOUPLE-${Date.now()}`;
    const claim = new Claim({
      claimId: decouplingJobId,
      jobId: decouplingJobId,
      status: CLAIM_STATUS.PENDING_REVIEW,
      incident: {
        date: '2026-09-09',
        description: 'Decoupling test'
      },
      aiAssessment: {
        recommendation: 'APPROVE',
        confidence: 'HIGH',
        scores: { damage: 1.0, fraud: 0.1, consistency: 9.8 }
      },
      decision: {
        outcome: 'PENDING'
      }
    });
    await claim.save();

    const fetched = await Claim.findOne({ claimId: decouplingJobId });
    assert.strictEqual(fetched.aiAssessment.recommendation, 'APPROVE');
    assert.strictEqual(fetched.status, 'PENDING_REVIEW');
    assert.notStrictEqual(fetched.status, 'APPROVED');
    assert.strictEqual(fetched.decision.outcome, 'PENDING');
  });

  const fullWorkflowJobId = `CLM-FLOW-${Date.now()}`;
  await test('Full lifecycle path: SUBMITTED -> PROCESSING -> AI_ASSESSED -> PENDING_REVIEW', async () => {
    const claim = new Claim({
      claimId: fullWorkflowJobId,
      jobId: fullWorkflowJobId,
      claimType: 'PHOTO_IMAGE',
      status: CLAIM_STATUS.SUBMITTED,
      customer: {
        customerId: 'CUST-1001',
        name: 'Marcus Vance',
        email: 'm.vance@example.com',
        phone: '+1 555-0922'
      },
      policy: {
        policyNumber: 'POL-FLOW-01',
        policyType: 'Comprehensive Motor',
        coverageType: 'Standard Collision',
        deductible: '$500'
      },
      vehicle: {
        registration: 'FLOW-110',
        make: 'Subaru',
        model: 'Outback',
        year: 2023
      },
      incident: {
        date: '2026-09-02',
        time: '14:20',
        location: 'Interstate 80, Mile 45',
        incidentType: 'Side impact',
        description: 'Side door damaged during lane merge.'
      },
      evidence: [{
        type: 'PHOTO',
        fileReference: 'uploads/side_door.jpg',
        originalName: 'side_door.jpg',
        uploadTimestamp: new Date(),
        processingStatus: 'PENDING'
      }],
      aiAssessment: {
        recommendation: 'MANUAL_REVIEW',
        confidence: 'MEDIUM',
        scores: { damage: 4.0, fraud: 2.0, consistency: 8.5 }
      }
    });

    await claim.save();
    assert.strictEqual(claim.status, 'SUBMITTED');

    const resProc = await axios.patch(
      `${API_URL}/claims/${fullWorkflowJobId}/status`,
      { status: 'PROCESSING', assessorNotes: 'Pipeline started' },
      authHeader
    );
    assert.strictEqual(resProc.status, 200);
    assert.strictEqual(resProc.data.claim.status, 'PROCESSING');

    const resAi = await axios.patch(
      `${API_URL}/claims/${fullWorkflowJobId}/status`,
      { status: 'AI_ASSESSED', assessorNotes: 'Inference completed' },
      authHeader
    );
    assert.strictEqual(resAi.status, 200);
    assert.strictEqual(resAi.data.claim.status, 'AI_ASSESSED');

    const resPending = await axios.patch(
      `${API_URL}/claims/${fullWorkflowJobId}/status`,
      { status: 'PENDING_REVIEW', assessorNotes: 'Assigned to inspection queue' },
      authHeader
    );
    assert.strictEqual(resPending.status, 200);
    assert.strictEqual(resPending.data.claim.status, 'PENDING_REVIEW');
  });

  await test('Invalid state transition rejection: directly from PENDING_REVIEW to APPROVED (400)', async () => {
    try {
      await axios.patch(
        `${API_URL}/claims/${fullWorkflowJobId}/status`,
        { status: 'APPROVED', assessorNotes: 'Premature approval without review' },
        authHeader
      );
      assert.fail('Should have rejected invalid transition with 400');
    } catch (err) {
      assert.strictEqual(err.response?.status, 400);
      assert.ok(err.response?.data?.error.includes('Invalid lifecycle state transition'));
    }
  });

  await test('Invalid state transition rejection: directly from PENDING_REVIEW to REJECTED (400)', async () => {
    try {
      await axios.patch(
        `${API_URL}/claims/${fullWorkflowJobId}/status`,
        { status: 'REJECTED', assessorNotes: 'Premature rejection without review' },
        authHeader
      );
      assert.fail('Should have rejected invalid transition with 400');
    } catch (err) {
      assert.strictEqual(err.response?.status, 400);
      assert.ok(err.response?.data?.error.includes('Invalid lifecycle state transition'));
    }
  });

  await test('Valid state transition: PENDING_REVIEW to UNDER_REVIEW (200)', async () => {
    const res = await axios.patch(
      `${API_URL}/claims/${fullWorkflowJobId}/status`,
      { status: 'UNDER_REVIEW', assessorNotes: 'Assessor started investigation' },
      authHeader
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.claim.status, 'UNDER_REVIEW');
    assert.strictEqual(res.data.claim.humanAssessment.action, 'UNDER_REVIEW');
    assert.strictEqual(res.data.claim.humanAssessment.assessor.id, assessorUser.id);
  });

  await test('Valid state transition: UNDER_REVIEW to NEEDS_INFORMATION (200)', async () => {
    const res = await axios.patch(
      `${API_URL}/claims/${fullWorkflowJobId}/status`,
      { status: 'NEEDS_INFORMATION', assessorNotes: 'Need clearer photos of rear bumper' },
      authHeader
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.claim.status, 'NEEDS_INFORMATION');
    assert.strictEqual(res.data.claim.humanAssessment.action, 'REQUEST_INFORMATION');
    assert.strictEqual(res.data.claim.decision.outcome, 'NEEDS_INFORMATION');
  });

  await test('Invalid state transition rejection: from NEEDS_INFORMATION directly to APPROVED (400)', async () => {
    try {
      await axios.patch(
        `${API_URL}/claims/${fullWorkflowJobId}/status`,
        { status: 'APPROVED', assessorNotes: 'Cannot approve while information is missing' },
        authHeader
      );
      assert.fail('Should have rejected invalid transition with 400');
    } catch (err) {
      assert.strictEqual(err.response?.status, 400);
      assert.ok(err.response?.data?.error.includes('Invalid lifecycle state transition'));
    }
  });

  await test('Valid state transition: NEEDS_INFORMATION back to UNDER_REVIEW (200)', async () => {
    const res = await axios.patch(
      `${API_URL}/claims/${fullWorkflowJobId}/status`,
      { status: 'UNDER_REVIEW', assessorNotes: 'Supplemental info received, resuming review' },
      authHeader
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.claim.status, 'UNDER_REVIEW');
  });

  await test('Valid state transition: UNDER_REVIEW to APPROVED with recorded decision (200)', async () => {
    const res = await axios.patch(
      `${API_URL}/claims/${fullWorkflowJobId}/status`,
      { status: 'APPROVED', assessorNotes: 'Damage verified against photos and narrative' },
      authHeader
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.claim.status, 'APPROVED');
    assert.strictEqual(res.data.claim.decision.outcome, 'APPROVED');
    assert.strictEqual(res.data.claim.decision.decisionMaker.id, assessorUser.id);
    assert.strictEqual(res.data.claim.humanAssessment.action, 'APPROVED');
    assert.strictEqual(res.data.claim.humanAssessment.assessor.id, assessorUser.id);
  });

  await test('Invalid state transition rejection: from APPROVED back to UNDER_REVIEW (400)', async () => {
    try {
      await axios.patch(
        `${API_URL}/claims/${fullWorkflowJobId}/status`,
        { status: 'UNDER_REVIEW', assessorNotes: 'Cannot reopen approved claim directly' },
        authHeader
      );
      assert.fail('Should have rejected invalid transition with 400');
    } catch (err) {
      assert.strictEqual(err.response?.status, 400);
      assert.ok(err.response?.data?.error.includes('Invalid lifecycle state transition'));
    }
  });

  await test('Valid state transition: APPROVED to CLOSED (200)', async () => {
    const res = await axios.patch(
      `${API_URL}/claims/${fullWorkflowJobId}/status`,
      { status: 'CLOSED', assessorNotes: 'Settlement processed, claim closed' },
      authHeader
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.claim.status, 'CLOSED');
    assert.strictEqual(res.data.claim.decision.outcome, 'CLOSED');
  });

  await test('Terminal state protection: CLOSED claim rejects further transitions (400)', async () => {
    try {
      await axios.patch(
        `${API_URL}/claims/${fullWorkflowJobId}/status`,
        { status: 'UNDER_REVIEW', assessorNotes: 'Attempting to alter closed claim' },
        authHeader
      );
      assert.fail('Should have rejected transition from CLOSED with 400');
    } catch (err) {
      assert.strictEqual(err.response?.status, 400);
      assert.ok(err.response?.data?.error.includes('Invalid lifecycle state transition'));
    }
  });

  await test('Alternative path: UNDER_REVIEW to REJECTED to CLOSED', async () => {
    const rejectJobId = `CLM-REJECT-${Date.now()}`;
    const claim = new Claim({
      claimId: rejectJobId,
      jobId: rejectJobId,
      status: CLAIM_STATUS.UNDER_REVIEW,
      incident: { date: '2026-09-03', description: 'Rejection test' },
      customer: { name: 'John Doe' },
      policy: { policyNumber: 'POL-REJ-01' },
      vehicle: { registration: 'REJ-001' }
    });
    await claim.save();

    const rejectRes = await axios.patch(
      `${API_URL}/claims/${rejectJobId}/status`,
      { status: 'REJECTED', assessorNotes: 'Evidence showed prior existing damage' },
      authHeader
    );
    assert.strictEqual(rejectRes.status, 200);
    assert.strictEqual(rejectRes.data.claim.status, 'REJECTED');
    assert.strictEqual(rejectRes.data.claim.decision.outcome, 'REJECTED');

    const closeRes = await axios.patch(
      `${API_URL}/claims/${rejectJobId}/status`,
      { status: 'CLOSED', assessorNotes: 'Denial notice dispatched, closing file' },
      authHeader
    );
    assert.strictEqual(closeRes.status, 200);
    assert.strictEqual(closeRes.data.claim.status, 'CLOSED');
  });

  await test('Reject invalid status string entirely (400)', async () => {
    try {
      await axios.patch(
        `${API_URL}/claims/${fullWorkflowJobId}/status`,
        { status: 'NOT_A_VALID_STATUS', assessorNotes: 'Bogus status test' },
        authHeader
      );
      assert.fail('Should have rejected invalid status name with 400');
    } catch (err) {
      assert.strictEqual(err.response?.status, 400);
      assert.ok(err.response?.data?.error.includes('Invalid status'));
    }
  });

  await mongoose.disconnect();

  console.log(`\nLifecycle Test Summary: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
};

runLifecycleTests();
