const assert = require('assert');
const axios = require('axios');

const API_URL = process.env.TEST_API_URL || 'http://localhost:5000/api';

const runTests = async () => {
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

  await test('Normal users cannot become admins via registration payload', async () => {
    const testEmail = `test_assessor_${Date.now()}@insureauto.ai`;
    const res = await axios.post(`${API_URL}/auth/register`, {
      name: 'Attempted Admin',
      email: testEmail,
      password: 'Password@123',
      role: 'ADMIN'
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.user.role, 'ASSESSOR');
  });

  await test('Unauthenticated users cannot access protected claims queue (401)', async () => {
    try {
      await axios.get(`${API_URL}/claims`);
      assert.fail('Should have failed with 401');
    } catch (err) {
      assert.strictEqual(err.response?.status, 401);
    }
  });

  await test('Unauthenticated users cannot override or modify claims (401)', async () => {
    try {
      await axios.patch(`${API_URL}/claims/CLM-DUMMY/override`, {
        newRecommendation: 'APPROVE',
        reason: 'Fraudulent override attempt'
      });
      assert.fail('Should have failed with 401');
    } catch (err) {
      assert.strictEqual(err.response?.status, 401);
    }
  });

  let assessorToken = '';
  let assessorUser = null;
  await test('Assessor logs in and receives valid JWT token', async () => {
    const res = await axios.post(`${API_URL}/auth/login`, {
      email: 'assessor@insureauto.ai',
      password: 'Password@123'
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.data.token);
    assert.strictEqual(res.data.user.role, 'ASSESSOR');
    assessorToken = res.data.token;
    assessorUser = res.data.user;
  });

  await test('Assessor can access claims queue with valid token (200)', async () => {
    const res = await axios.get(`${API_URL}/claims`, {
      headers: { Authorization: `Bearer ${assessorToken}` }
    });

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.data.claims));
  });

  let adminToken = '';
  await test('Admin logs in and receives valid JWT token', async () => {
    const res = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@insureauto.ai',
      password: 'AdminPassword@123'
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.data.token);
    assert.strictEqual(res.data.user.role, 'ADMIN');
    adminToken = res.data.token;
  });

  await test('Privileged admin route rejects non-admin assessors (403)', async () => {
    try {
      await axios.get(`${API_URL}/auth/users`, {
        headers: { Authorization: `Bearer ${assessorToken}` }
      });
      assert.fail('Should have rejected assessor with 403');
    } catch (err) {
      assert.strictEqual(err.response?.status, 403);
    }
  });

  await test('Privileged admin route accepts authenticated admin (200)', async () => {
    const res = await axios.get(`${API_URL}/auth/users`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.data.users));
  });

  await test('Claim override enforces assessor identity from authenticated token', async () => {
    const claimsRes = await axios.get(`${API_URL}/claims`, {
      headers: { Authorization: `Bearer ${assessorToken}` }
    });

    const activeClaim = claimsRes.data.claims.find(c => c.status === 'UNDER_REVIEW') ||
                        claimsRes.data.claims.find(c => c.status === 'PENDING_REVIEW');

    if (activeClaim) {
      if (activeClaim.status === 'PENDING_REVIEW') {
        await axios.patch(
          `${API_URL}/claims/${activeClaim.jobId}/status`,
          { status: 'UNDER_REVIEW', assessorNotes: 'Preparing for override audit test' },
          { headers: { Authorization: `Bearer ${assessorToken}` } }
        );
      }

      const overrideRes = await axios.patch(
        `${API_URL}/claims/${activeClaim.jobId}/override`,
        {
          newRecommendation: 'APPROVE',
          reason: 'Automated test justification audit',
          assessorId: 'FAKE_SPOOFED_ID'
        },
        {
          headers: { Authorization: `Bearer ${assessorToken}` }
        }
      );

      assert.strictEqual(overrideRes.status, 200);
      assert.strictEqual(overrideRes.data.claim.assessorOverride.assessorId, assessorUser.id);
      assert.notStrictEqual(overrideRes.data.claim.assessorOverride.assessorId, 'FAKE_SPOOFED_ID');
    } else {
      console.log('Skipping override detail check: no claims in database.');
    }
  });

  console.log(`\nAuthorization Test Summary: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
};

runTests();
