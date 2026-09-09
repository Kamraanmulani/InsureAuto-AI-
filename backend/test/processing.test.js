require('dotenv').config();
const assert = require('assert');
const axios = require('axios');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const Claim = require('../src/models/Claim');
const { CLAIM_STATUS } = require('../src/models/Claim');
const claimService = require('../src/services/claimService');
const config = require('../src/config/env');

const API_URL = process.env.TEST_API_URL || `http://localhost:${config.port}/api`;
const MONGO_URI = config.mongoUri;

const runProcessingTests = async () => {
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

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(MONGO_URI);
  }

  let assessorToken = '';
  await test('Authenticate assessor for processing workflow tests', async () => {
    const res = await axios.post(`${API_URL}/auth/login`, {
      email: 'assessor@insureauto.ai',
      password: 'Password@123'
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.token);
    assessorToken = res.data.token;
  });

  const authHeader = {
    headers: { Authorization: `Bearer ${assessorToken}` }
  };

  const dummyMediaPath = path.join(__dirname, 'dummy_test_damage.jpg');
  fs.writeFileSync(dummyMediaPath, Buffer.from('FAKE_JPEG_IMAGE_DATA_FOR_INTAKE_TEST'));

  let createdJobId = null;
  let createdClaimId = null;

  await test('1 & 2: Claim creation returns immediate API response with PROCESSING status', async () => {
    const form = new FormData();
    form.append('image', fs.createReadStream(dummyMediaPath), 'dummy_test_damage.jpg');
    form.append('claim_date', '2026-09-09');
    form.append('claim_description', 'Immediate response asynchronous intake test description');
    form.append('claim_location', 'Expressway Junction 4');
    form.append('policy_id', 'POL-ASYNC-100');

    const startTime = Date.now();
    const res = await axios.post(`${API_URL}/claims/analyze`, form, {
      headers: {
        Authorization: `Bearer ${assessorToken}`,
        ...form.getHeaders()
      }
    });
    const elapsedMs = Date.now() - startTime;

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.jobId);
    assert.ok(res.data.claimId);
    assert.strictEqual(res.data.status, CLAIM_STATUS.PROCESSING);
    assert.strictEqual(res.data.processingStatus, 'PROCESSING');
    assert.ok(elapsedMs < 2000, `Intake took ${elapsedMs}ms, should be immediate (< 2000ms)`);

    createdJobId = res.data.jobId;
    createdClaimId = res.data.claimId;
  });

  await test('3: Processing state is retrievable immediately from backend', async () => {
    const res = await axios.get(`${API_URL}/claims/${createdJobId}/processing-status`, authHeader);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.jobId, createdJobId);
    assert.strictEqual(res.data.claimId, createdClaimId);
    assert.strictEqual(res.data.status, CLAIM_STATUS.PROCESSING);
    assert.strictEqual(res.data.processingStatus, 'PROCESSING');
  });

  await test('4: Successful ML completion transitions status to AI_ASSESSED and stores results', async () => {
    const successJobId = `CLM-SUCC-${Date.now()}`;
    const successClaim = new Claim({
      claimId: successJobId,
      jobId: successJobId,
      status: CLAIM_STATUS.PROCESSING,
      incident: {
        date: '2026-09-09',
        description: 'Success worker test incident description'
      },
      evidence: [{
        type: 'PHOTO',
        fileReference: dummyMediaPath,
        rawFilePath: dummyMediaPath,
        originalName: 'dummy_test_damage.jpg',
        processingStatus: 'PROCESSING'
      }]
    });
    await successClaim.save();

    const originalForward = require('../src/services/mlService').forwardToML;
    require('../src/services/mlService').forwardToML = async () => ({
      success: true,
      job_id: successJobId,
      annotated_image_url: '/annotated/succ_test.jpg',
      primary_annotated_keyframe_url: '/annotated/succ_test.jpg',
      decision: {
        recommendation: 'APPROVE',
        confidence: 'HIGH',
        scores: { damage: 3.5, fraud: 0.5, consistency: 9.5 },
        explanation: 'Low severity verified damage.'
      },
      report: {
        damage_assessment: {
          severity: 'MINOR',
          damagedParts: ['front_bumper'],
          score: 3.5
        },
        fraud_analysis: {
          overall_score: 0.5,
          risk_level: 'LOW',
          is_duplicate: false
        },
        consistency_analysis: {
          score: 9.5,
          is_consistent: true
        }
      }
    });

    const processed = await claimService.processClaimJob(successJobId);
    require('../src/services/mlService').forwardToML = originalForward;

    assert.ok(processed);
    assert.strictEqual(processed.status, CLAIM_STATUS.AI_ASSESSED);
    assert.strictEqual(processed.evidence[0].processingStatus, 'COMPLETED');
    assert.strictEqual(processed.aiAssessment.recommendation, 'APPROVE');
    assert.strictEqual(processed.aiAssessment.scores.damage, 3.5);
    assert.strictEqual(processed.processingError.message, null);

    const lastAudit = processed.auditHistory[processed.auditHistory.length - 1];
    assert.strictEqual(lastAudit.action, 'AI_ASSESSMENT_COMPLETED');
    assert.strictEqual(lastAudit.newStatus, CLAIM_STATUS.AI_ASSESSED);
  });

  await test('5: ML failure safely preserves claim record and stores error details', async () => {
    const failJobId = `CLM-FAIL-${Date.now()}`;
    const failClaim = new Claim({
      claimId: failJobId,
      jobId: failJobId,
      status: CLAIM_STATUS.PROCESSING,
      incident: {
        date: '2026-09-09',
        description: 'Failure safety test incident description'
      },
      evidence: [{
        type: 'PHOTO',
        fileReference: '/invalid/path/missing_file.jpg',
        rawFilePath: '/invalid/path/missing_file.jpg',
        originalName: 'missing_file.jpg',
        processingStatus: 'PROCESSING'
      }]
    });
    await failClaim.save();

    await claimService.processClaimJob(failJobId);

    const persisted = await Claim.findOne({ claimId: failJobId });
    assert.ok(persisted, 'Claim record must NOT be deleted on ML processing failure');
    assert.strictEqual(persisted.status, CLAIM_STATUS.PROCESSING);
    assert.strictEqual(persisted.evidence[0].processingStatus, 'FAILED');
    assert.ok(persisted.processingError.message);
    assert.ok(persisted.processingError.timestamp);
    assert.strictEqual(persisted.processingError.retryCount, 1);

    const failureAudit = persisted.auditHistory.find(a => a.action === 'PROCESSING_FAILED');
    assert.ok(failureAudit);
  });

  await test('6: Retry handling resets processing state and re-dispatches job', async () => {
    const retryJobId = `CLM-RETRY-${Date.now()}`;
    const retryClaim = new Claim({
      claimId: retryJobId,
      jobId: retryJobId,
      status: CLAIM_STATUS.PROCESSING,
      incident: {
        date: '2026-09-09',
        description: 'Retry flow test incident description'
      },
      evidence: [{
        type: 'PHOTO',
        fileReference: dummyMediaPath,
        rawFilePath: dummyMediaPath,
        originalName: 'dummy_test_damage.jpg',
        processingStatus: 'FAILED',
        error: 'Prior connection timeout'
      }],
      processingError: {
        message: 'Prior connection timeout',
        details: 'ECONNRESET',
        timestamp: new Date(),
        retryCount: 1
      }
    });
    await retryClaim.save();

    const res = await axios.post(`${API_URL}/claims/${retryJobId}/retry`, {}, authHeader);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.claim.status, CLAIM_STATUS.PROCESSING);
    assert.strictEqual(res.data.claim.evidence[0].processingStatus, 'PROCESSING');
    assert.strictEqual(res.data.claim.processingError.message, null);
    assert.strictEqual(res.data.claim.processingError.retryCount, 2);

    const reloaded = await Claim.findOne({ claimId: retryJobId });
    const retryAudit = reloaded.auditHistory.find(a => a.action === 'PROCESSING_RETRY_INITIATED');
    assert.ok(retryAudit);
  });

  await test('6b: Retry is rejected on closed or adjudicated claims (400)', async () => {
    const closedJobId = `CLM-CLOSED-${Date.now()}`;
    const closedClaim = new Claim({
      claimId: closedJobId,
      jobId: closedJobId,
      status: CLAIM_STATUS.CLOSED,
      incident: {
        date: '2026-09-09',
        description: 'Closed claim rejection test'
      }
    });
    await closedClaim.save();

    try {
      await axios.post(`${API_URL}/claims/${closedJobId}/retry`, {}, authHeader);
      assert.fail('Should reject retry on closed claim');
    } catch (err) {
      assert.strictEqual(err.response?.status, 400);
      assert.strictEqual(err.response?.data?.success, false);
      assert.ok(err.response?.data?.error.includes('Cannot retry processing'));
    }
  });

  if (fs.existsSync(dummyMediaPath)) {
    try { fs.unlinkSync(dummyMediaPath); } catch (e) {}
  }

  await mongoose.disconnect();

  console.log(`\nProcessing Test Summary: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
};

runProcessingTests();
