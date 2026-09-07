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

router.use(verifyToken);
router.use(requireRole('ASSESSOR', 'ADMIN'));

router.post('/analyze', upload.any(), analyzeClaim);
router.get('/', getClaims);
router.get('/stats/summary', getClaimStats);
router.get('/:jobId', getClaimById);
router.patch('/:jobId/status', updateClaimStatus);
router.patch('/:jobId/override', overrideDecision);

module.exports = router;
