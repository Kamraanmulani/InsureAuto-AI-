const claimService = require('../services/claimService');
const { sendSuccess } = require('../utils/apiResponse');
const { parsePagination } = require('../utils/validators');

const analyzeClaim = async (req, res, next) => {
  const uploadedFile = req.files && req.files.length > 0 ? req.files[0] : null;

  try {
    const claim = await claimService.analyzeAndCreateClaim({
      uploadedFile,
      claimData: req.body,
      user: req.user
    });

    return sendSuccess(res, 200, { claim }, 'Claim analyzed and recorded successfully');
  } catch (error) {
    next(error);
  }
};

const getClaims = async (req, res, next) => {
  try {
    const { status, recommendation, policy_id, claim_type, search } = req.query;
    const { limit, skip } = parsePagination(req.query);

    const { total, claims } = await claimService.getClaims({
      status,
      recommendation,
      policy_id,
      claim_type,
      search,
      limit,
      skip
    });

    return sendSuccess(res, 200, { total, claims });
  } catch (error) {
    next(error);
  }
};

const getClaimById = async (req, res, next) => {
  try {
    const claim = await claimService.getClaimById(req.params.jobId);
    return sendSuccess(res, 200, { claim });
  } catch (error) {
    next(error);
  }
};

const updateClaimStatus = async (req, res, next) => {
  try {
    const { status, assessorNotes } = req.body;
    const claim = await claimService.updateClaimStatus(req.params.jobId, {
      status,
      assessorNotes,
      user: req.user
    });

    return sendSuccess(res, 200, { claim }, 'Claim status updated successfully');
  } catch (error) {
    next(error);
  }
};

const overrideDecision = async (req, res, next) => {
  try {
    const { newRecommendation, reason } = req.body;
    const claim = await claimService.overrideClaimDecision(req.params.jobId, {
      newRecommendation,
      reason,
      user: req.user
    });

    return sendSuccess(res, 200, { claim }, 'Decision override recorded successfully');
  } catch (error) {
    next(error);
  }
};

const getClaimStats = async (req, res, next) => {
  try {
    const stats = await claimService.getClaimStats();
    return sendSuccess(res, 200, { stats });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  analyzeClaim,
  getClaims,
  getClaimById,
  updateClaimStatus,
  overrideDecision,
  getClaimStats
};
