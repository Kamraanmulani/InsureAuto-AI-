const fs = require('fs');
const Claim = require('../models/Claim');
const { forwardToML } = require('../services/mlService');
const { isVideoFile } = require('../middleware/uploadMiddleware');

const analyzeClaim = async (req, res) => {
  const uploadedFile = req.files && req.files.length > 0 ? req.files[0] : null;

  try {
    const { claim_date, claim_description, claim_location, policy_id } = req.body;

    if (!uploadedFile) {
      return res.status(400).json({ error: 'Photo or walk-around video file is required' });
    }

    if (!claim_date || !claim_description) {
      if (fs.existsSync(uploadedFile.path)) {
        fs.unlinkSync(uploadedFile.path);
      }
      return res.status(400).json({ error: 'Incident date and description are required' });
    }

    const isVideo = isVideoFile(uploadedFile);

    let mlResult;
    try {
      mlResult = await forwardToML(uploadedFile.path, uploadedFile.originalname, isVideo, {
        claim_date,
        claim_description,
        claim_location,
        policy_id
      });
    } catch (mlError) {
      if (uploadedFile && fs.existsSync(uploadedFile.path)) {
        fs.unlinkSync(uploadedFile.path);
      }
      const detailMsg = mlError.response?.data?.detail || mlError.message;
      return res.status(503).json({
        error: 'ML Backend is not available or analysis failed',
        details: mlError.code === 'ECONNREFUSED' ? 'Connection refused - ML backend not running on port 8000' : detailMsg
      });
    }

    if (uploadedFile && fs.existsSync(uploadedFile.path)) {
      fs.unlinkSync(uploadedFile.path);
    }

    if (!mlResult.success) {
      return res.status(500).json({ error: 'ML analysis did not complete successfully' });
    }

    const report = mlResult.report || {};
    const damageAssessment = report.damage_assessment || {};
    const fraudAnalysis = report.fraud_analysis || {};
    const consistencyAnalysis = report.consistency_analysis || {};
    const decisionData = mlResult.decision || report.decision || {};
    const videoEvidence = report.video_evidence || {};

    const claim = new Claim({
      jobId: mlResult.job_id,
      claimType: isVideo ? 'VIDEO_WALK_AROUND' : 'PHOTO_IMAGE',
      claimInfo: {
        date: claim_date,
        description: claim_description,
        location: claim_location || 'Unknown',
        policyId: policy_id || ''
      },
      metadata: isVideo
        ? (report.metadata || {})
        : (damageAssessment.metadata || {}),
      keyframeSelection: isVideo ? {
        primaryPath: videoEvidence.primary_annotated_keyframe_url || mlResult.primary_annotated_keyframe_url,
        secondaryPath: videoEvidence.secondary_annotated_keyframe_url,
        compositePath: videoEvidence.composite_path,
        llavaMode: videoEvidence.llava_mode,
        ranking: mlResult.keyframe_timeline || videoEvidence.keyframe_timeline || [],
        summary: videoEvidence.summary
      } : undefined,
      analysis: {
        damageAssessment: {
          severity: damageAssessment.severity || 'Unknown',
          damagedParts: damageAssessment.damaged_parts || [],
          description: damageAssessment.description || '',
          recommendation: damageAssessment.recommendation || '',
          score: damageAssessment.damage_score || damageAssessment.score || decisionData.scores?.damage || 0,
          yoloAggregate: damageAssessment.yolo_aggregate ? {
            areaCoverageRatio: damageAssessment.yolo_aggregate.area_coverage_ratio,
            meanConfidence: damageAssessment.yolo_aggregate.mean_confidence,
            totalKeyframeDetections: damageAssessment.yolo_aggregate.total_keyframe_detections
          } : undefined
        },
        fraudAnalysis: {
          overallScore: fraudAnalysis.overall_score || 0,
          riskLevel: fraudAnalysis.risk_level || 'LOW',
          isDuplicate: isVideo
            ? (fraudAnalysis.video_duplicate_check?.is_duplicate || false)
            : (fraudAnalysis.is_duplicate || false),
          fraudIndicators: fraudAnalysis.fraud_indicators || [],
          breakdown: fraudAnalysis.breakdown || fraudAnalysis.score_breakdown || {},
          videoDuplicateCheck: isVideo && fraudAnalysis.video_duplicate_check ? {
            isDuplicate: fraudAnalysis.video_duplicate_check.is_duplicate,
            similarityScore: fraudAnalysis.video_duplicate_check.similarity_score,
            crossPolicyReuse: fraudAnalysis.video_duplicate_check.cross_policy_reuse,
            isMirrored: fraudAnalysis.video_duplicate_check.is_mirrored,
            duplicateDetails: fraudAnalysis.video_duplicate_check.duplicate_details || []
          } : undefined,
          metadataFraud: isVideo && fraudAnalysis.metadata_fraud ? {
            score: fraudAnalysis.metadata_fraud.score,
            editingSoftwareDetected: fraudAnalysis.metadata_fraud.editing_software_detected,
            editingTools: fraudAnalysis.metadata_fraud.editing_tools || []
          } : undefined
        },
        consistencyAnalysis: {
          score: consistencyAnalysis.score || decisionData.scores?.consistency || 0,
          isConsistent: consistencyAnalysis.is_consistent !== undefined ? consistencyAnalysis.is_consistent : true,
          explanation: consistencyAnalysis.explanation || ''
        }
      },
      decision: {
        recommendation: decisionData.recommendation || 'MANUAL_REVIEW',
        confidence: decisionData.confidence || 'MEDIUM',
        explanation: decisionData.explanation || '',
        reasons: decisionData.reasons || decisionData.decision_factors || [],
        scores: decisionData.scores || {
          damage: damageAssessment.score || 0,
          fraud: fraudAnalysis.overall_score || 0,
          consistency: consistencyAnalysis.score || 0
        },
        pillarBreakdown: decisionData.pillar_breakdown || decisionData.pillar_aggregation || undefined
      },
      annotatedImagePath: mlResult.annotated_image_url || mlResult.primary_annotated_keyframe_url,
      primaryAnnotatedKeyframeUrl: mlResult.primary_annotated_keyframe_url,
      keyframeTimeline: mlResult.keyframe_timeline || [],
      status: 'PROCESSED'
    });

    await claim.save();

    res.json({
      success: true,
      claim: claim
    });
  } catch (error) {
    if (uploadedFile && fs.existsSync(uploadedFile.path)) {
      try { fs.unlinkSync(uploadedFile.path); } catch (e) {}
    }
    res.status(500).json({
      error: 'Failed to analyze claim',
      details: error.message
    });
  }
};

const getClaims = async (req, res) => {
  try {
    const { status, recommendation, policy_id, claim_type, limit = 50, skip = 0 } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (recommendation) filter['decision.recommendation'] = recommendation;
    if (policy_id) filter['claimInfo.policyId'] = policy_id;
    if (claim_type) filter.claimType = claim_type;

    const claims = await Claim.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .select('-__v');

    const total = await Claim.countDocuments(filter);

    res.json({
      success: true,
      total,
      claims
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch claims' });
  }
};

const getClaimById = async (req, res) => {
  try {
    const claim = await Claim.findOne({ jobId: req.params.jobId });
    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }
    res.json({
      success: true,
      claim
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch claim' });
  }
};

const updateClaimStatus = async (req, res) => {
  try {
    const { status, assessorNotes } = req.body;
    const validStatuses = ['PENDING', 'PROCESSED', 'REVIEWED', 'APPROVED', 'REJECTED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const claim = await Claim.findOne({ jobId: req.params.jobId });
    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    claim.status = status;
    if (assessorNotes) {
      claim.assessorNotes = assessorNotes;
    }

    await claim.save();

    res.json({
      success: true,
      claim
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update claim' });
  }
};

const overrideDecision = async (req, res) => {
  try {
    const { newRecommendation, reason, assessorId } = req.body;
    const validRecommendations = ['APPROVE', 'MANUAL_REVIEW', 'REJECT'];
    if (!validRecommendations.includes(newRecommendation)) {
      return res.status(400).json({ error: 'Invalid recommendation' });
    }

    const claim = await Claim.findOne({ jobId: req.params.jobId });
    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    claim.assessorOverride = {
      applied: true,
      originalRecommendation: claim.decision.recommendation,
      newRecommendation,
      reason,
      assessorId: assessorId || (req.user ? req.user.userId : 'ASSESSOR'),
      timestamp: new Date()
    };

    claim.decision.recommendation = newRecommendation;
    claim.status = newRecommendation === 'APPROVE' ? 'APPROVED' :
                   newRecommendation === 'REJECT' ? 'REJECTED' : 'REVIEWED';

    await claim.save();

    res.json({
      success: true,
      claim
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to override decision' });
  }
};

const getClaimStats = async (req, res) => {
  try {
    const totalClaims = await Claim.countDocuments();

    const statusCounts = await Claim.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const recommendationCounts = await Claim.aggregate([
      { $group: { _id: '$decision.recommendation', count: { $sum: 1 } } }
    ]);

    const claimTypeCounts = await Claim.aggregate([
      { $group: { _id: '$claimType', count: { $sum: 1 } } }
    ]);

    const avgScores = await Claim.aggregate([
      {
        $group: {
          _id: null,
          avgDamageScore: { $avg: '$decision.scores.damage' },
          avgFraudScore: { $avg: '$decision.scores.fraud' },
          avgConsistencyScore: { $avg: '$decision.scores.consistency' }
        }
      }
    ]);

    res.json({
      success: true,
      stats: {
        totalClaims,
        claimTypeDistribution: claimTypeCounts,
        statusDistribution: statusCounts,
        recommendationDistribution: recommendationCounts,
        averageScores: avgScores[0] || {}
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch statistics' });
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
