const express = require('express');
const router = express.Router();
const { upload } = require('../middleware/uploadMiddleware');
const {
  analyzeClaim,
  getClaims,
  getClaimById,
  updateClaimStatus,
  overrideDecision,
  getClaimStats
} = require('../controllers/claimController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const {
  validateClaimAnalyze,
  validateStatusUpdate,
  validateDecisionOverride
} = require('../middleware/validateMiddleware');

router.use(verifyToken);
router.use(requireRole('ASSESSOR', 'ADMIN'));

router.post('/analyze', upload.any(), validateClaimAnalyze, analyzeClaim);
router.get('/', getClaims);
router.get('/stats/summary', getClaimStats);
router.get('/:jobId', getClaimById);
router.patch('/:jobId/status', validateStatusUpdate, updateClaimStatus);
router.patch('/:jobId/override', validateDecisionOverride, overrideDecision);

module.exports = router;
