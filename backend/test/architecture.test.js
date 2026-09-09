require('dotenv').config();
const assert = require('assert');
const axios = require('axios');
const mongoose = require('mongoose');
const authService = require('../src/services/authService');
const claimService = require('../src/services/claimService');
const Claim = require('../src/models/Claim');
const { CLAIM_STATUS } = require('../src/models/Claim');
const config = require('../src/config/env');

const API_URL = process.env.TEST_API_URL || `http://localhost:${config.port}/api`;
const MONGO_URI = config.mongoUri;

const runArchitectureTests = async () => {
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
  let assessorUser = null;
  await test('Authenticate assessor for architecture validation tests', async () => {
    const res = await axios.post(`${API_URL}/auth/login`, {
      email: 'assessor@insureauto.ai',
      password: 'Password@123'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.token);
    assert.ok(res.data.user);
    assessorToken = res.data.token;
    assessorUser = res.data.user;
  });

  const authHeader = {
    headers: { Authorization: `Bearer ${assessorToken}` }
  };

  await test('Validation: Registration rejects invalid email format (400)', async () => {
    try {
      await axios.post(`${API_URL}/auth/register`, {
        email: 'not-an-email',
        password: 'Password@123',
        name: 'Invalid Email User'
      });
      assert.fail('Should have rejected with 400');
    } catch (err) {
      assert.strictEqual(err.response?.status, 400);
      assert.strictEqual(err.response?.data?.success, false);
      assert.ok(err.response?.data?.error.includes('valid email'));
      assert.strictEqual(err.response?.data?.stack, undefined);
    }
  });

  await test('Validation: Registration rejects short passwords (400)', async () => {
    try {
      await axios.post(`${API_URL}/auth/register`, {
        email: `valid.${Date.now()}@example.com`,
        password: '123',
        name: 'Short Password User'
      });
      assert.fail('Should have rejected with 400');
    } catch (err) {
      assert.strictEqual(err.response?.status, 400);
      assert.strictEqual(err.response?.data?.success, false);
      assert.ok(err.response?.data?.error.includes('at least 6 characters'));
      assert.strictEqual(err.response?.data?.stack, undefined);
    }
  });

  await test('Security: Registration strips injected role and forces ASSESSOR', async () => {
    const uniqueEmail = `test.assessor.${Date.now()}@example.com`;
    const res = await axios.post(`${API_URL}/auth/register`, {
      email: uniqueEmail,
      password: 'Password@123',
      name: 'Sneaky User',
      role: 'ADMIN'
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.user.role, 'ASSESSOR');
  });

  await test('Security: Claim status update ignores spoofed assessorId in body', async () => {
    const testClaimId = `CLM-SEC-${Date.now()}`;
    const claim = new Claim({
      claimId: testClaimId,
      jobId: testClaimId,
      status: CLAIM_STATUS.UNDER_REVIEW,
      incident: { date: '2026-09-09', description: 'Security test claim' }
    });
    await claim.save();

    const res = await axios.patch(
      `${API_URL}/claims/${testClaimId}/status`,
      {
        status: 'NEEDS_INFORMATION',
        assessorNotes: 'Requesting photos',
        assessorId: 'SPOOFED_EVIL_ID',
        decisionMaker: { id: 'SPOOFED_DECISION_MAKER' }
      },
      authHeader
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.claim.status, 'NEEDS_INFORMATION');
    assert.strictEqual(res.data.claim.humanAssessment.assessor.id, assessorUser.id);
    assert.notStrictEqual(res.data.claim.humanAssessment.assessor.id, 'SPOOFED_EVIL_ID');
    assert.strictEqual(res.data.claim.decision.decisionMaker.id, assessorUser.id);
    assert.notStrictEqual(res.data.claim.decision.decisionMaker.id, 'SPOOFED_DECISION_MAKER');
  });

  await test('Security: Override justification is mandatory (400)', async () => {
    const testClaimId = `CLM-OVR-${Date.now()}`;
    const claim = new Claim({
      claimId: testClaimId,
      jobId: testClaimId,
      status: CLAIM_STATUS.UNDER_REVIEW,
      incident: { date: '2026-09-09', description: 'Override test claim' }
    });
    await claim.save();

    try {
      await axios.patch(
        `${API_URL}/claims/${testClaimId}/override`,
        {
          newRecommendation: 'APPROVE',
          reason: '   '
        },
        authHeader
      );
      assert.fail('Should have rejected empty reason with 400');
    } catch (err) {
      assert.strictEqual(err.response?.status, 400);
      assert.strictEqual(err.response?.data?.success, false);
      assert.ok(err.response?.data?.error.includes('Justification reason is required'));
    }
  });

  await test('Error Handling: Non-existent route returns clean 404 without stack trace', async () => {
    try {
      await axios.get(`${API_URL}/non-existent-endpoint`, authHeader);
      assert.fail('Should have returned 404');
    } catch (err) {
      assert.strictEqual(err.response?.status, 404);
      assert.strictEqual(err.response?.data?.success, false);
      assert.ok(err.response?.data?.error.includes('Route not found'));
      assert.strictEqual(err.response?.data?.stack, undefined);
    }
  });

  await test('Pagination & Filtering: GET /claims respects limit and filtering', async () => {
    const res = await axios.get(`${API_URL}/claims?limit=2&skip=0`, authHeader);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(typeof res.data.total === 'number');
    assert.ok(Array.isArray(res.data.claims));
    assert.ok(res.data.claims.length <= 2);
  });

  await test('Service Layer: claimService.getClaimById throws 404 ApiError on unknown ID', async () => {
    let threw = false;
    try {
      await claimService.getClaimById('NON_EXISTENT_CLAIM_ID_XYZ');
    } catch (err) {
      threw = true;
      assert.strictEqual(err.statusCode, 404);
      assert.strictEqual(err.message, 'Claim not found');
    }
    assert.strictEqual(threw, true);
  });

  await test('Service Layer: authService.login throws 401 ApiError on incorrect password', async () => {
    let threw = false;
    try {
      await authService.login({ email: 'assessor@insureauto.ai', password: 'WrongPassword' });
    } catch (err) {
      threw = true;
      assert.strictEqual(err.statusCode, 401);
      assert.strictEqual(err.message, 'Invalid credentials');
    }
    assert.strictEqual(threw, true);
  });

  await mongoose.disconnect();

  console.log(`\nArchitecture Test Summary: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
};

runArchitectureTests();
