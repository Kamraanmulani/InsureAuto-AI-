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

router.post('/analyze', upload.any(), analyzeClaim);
router.get('/', getClaims);
router.get('/stats/summary', getClaimStats);
router.get('/:jobId', getClaimById);
router.patch('/:jobId/status', updateClaimStatus);
router.patch('/:jobId/override', overrideDecision);

module.exports = router;
