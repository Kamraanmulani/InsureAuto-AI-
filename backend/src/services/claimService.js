const fs = require('fs');
const Claim = require('../models/Claim');
const { CLAIM_STATUS } = require('../models/Claim');
const ApiError = require('../utils/apiError');
const { forwardToML } = require('./mlService');
const { isVideoFile } = require('../middleware/uploadMiddleware');

const analyzeAndCreateClaim = async ({ uploadedFile, claimData, user }) => {
  if (!uploadedFile) {
    throw ApiError.badRequest('Photo or walk-around video file is required');
  }

  const isVideo = isVideoFile(uploadedFile);

  let mlResult;
  try {
    mlResult = await forwardToML(uploadedFile.path, uploadedFile.originalname, isVideo, {
      claim_date: claimData.claim_date,
      claim_description: claimData.claim_description,
      claim_location: claimData.claim_location,
      policy_id: claimData.policy_id
    });
  } catch (mlError) {
    if (uploadedFile && fs.existsSync(uploadedFile.path)) {
      try { fs.unlinkSync(uploadedFile.path); } catch (e) {}
    }
    const detailMsg = mlError.response?.data?.detail || mlError.message;
    throw ApiError.serviceUnavailable(
      'ML Backend is not available or analysis failed',
      mlError.code === 'ECONNREFUSED' ? 'Connection refused - ML backend not running on port 8000' : detailMsg
    );
  }

  if (uploadedFile && fs.existsSync(uploadedFile.path)) {
    try { fs.unlinkSync(uploadedFile.path); } catch (e) {}
  }

  if (!mlResult || !mlResult.success) {
    throw ApiError.internal('ML analysis did not complete successfully');
  }

  const report = mlResult.report || {};
  const damageAssessment = report.damage_assessment || {};
  const fraudAnalysis = report.fraud_analysis || {};
  const consistencyAnalysis = report.consistency_analysis || {};
  const decisionData = mlResult.decision || report.decision || {};
  const videoEvidence = report.video_evidence || {};

  const claimId = mlResult.job_id.startsWith('CLM-')
    ? mlResult.job_id
    : `CLM-${mlResult.job_id.slice(0, 8).toUpperCase()}`;

  const actorId = user ? user.userId : 'INTAKE_SYSTEM';
  const actorName = user ? user.name : 'Intake Gateway';
  const actorRole = user ? user.role : 'SYSTEM';

  const claim = new Claim({
    claimId,
    jobId: mlResult.job_id,
    claimType: isVideo ? 'VIDEO_WALK_AROUND' : 'PHOTO_IMAGE',
    status: CLAIM_STATUS.PENDING_REVIEW,
    customer: {
      customerId: `CUST-${(claimData.policy_id || '999').replace(/\D/g, '').slice(0, 4) || '101'}`,
      name: claimData.customer_name || `Policyholder (${claimData.policy_id || 'Unassigned'})`,
      email: claimData.customer_email || 'client@insureauto.ai',
      phone: claimData.customer_phone || '+1 (555) 019-2831'
    },
    policy: {
      policyNumber: claimData.policy_id || 'POL-UNASSIGNED',
      policyType: 'Comprehensive Motor Policy',
      coverageType: 'Full Collision & Comprehensive',
      deductible: '$500',
      effectiveDate: 'Jan 2026'
    },
    vehicle: {
      registration: claimData.vehicle_registration || 'UNREGISTERED',
      make: claimData.vehicle_make || (report.metadata?.vehicle_make || 'Standard'),
      model: claimData.vehicle_model || (report.metadata?.vehicle_model || 'Vehicle'),
      year: claimData.vehicle_year ? parseInt(claimData.vehicle_year, 10) : 2022,
      vin: `1HGCR2F8${mlResult.job_id.slice(0, 8).toUpperCase()}`
    },
    incident: {
      date: claimData.claim_date,
      time: claimData.incident_time || '12:00 PM',
      location: claimData.claim_location || 'Unknown Location',
      incidentType: claimData.incident_type || 'Collision',
      description: claimData.claim_description
    },
    evidence: [{
      type: isVideo ? 'VIDEO' : 'PHOTO',
      fileReference: mlResult.primary_annotated_keyframe_url || mlResult.annotated_image_url || uploadedFile.originalname,
      originalName: uploadedFile.originalname,
      uploadTimestamp: new Date(),
      metadata: isVideo ? (report.metadata || {}) : (damageAssessment.metadata || {}),
      processingStatus: 'COMPLETED',
      analysisResults: {
        keyframeRanking: mlResult.keyframe_timeline || videoEvidence.keyframe_timeline || [],
        damageAssessment,
        fraudAnalysis,
        consistencyAnalysis
      }
    }],
    aiAssessment: {
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
      fraudAssessment: {
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
      consistencyAssessment: {
        score: consistencyAnalysis.score || decisionData.scores?.consistency || 0,
        isConsistent: consistencyAnalysis.is_consistent !== undefined ? consistencyAnalysis.is_consistent : true,
        explanation: consistencyAnalysis.explanation || ''
      },
      recommendation: decisionData.recommendation || 'MANUAL_REVIEW',
      confidence: decisionData.confidence || 'MEDIUM',
      explanation: decisionData.explanation || '',
      scores: decisionData.scores || {
        damage: damageAssessment.score || 0,
        fraud: fraudAnalysis.overall_score || 0,
        consistency: consistencyAnalysis.score || 0
      },
      keyframeSelection: isVideo ? {
        primaryPath: videoEvidence.primary_annotated_keyframe_url || mlResult.primary_annotated_keyframe_url,
        secondaryPath: videoEvidence.secondary_annotated_keyframe_url,
        compositePath: videoEvidence.composite_path,
        llavaMode: videoEvidence.llava_mode,
        ranking: mlResult.keyframe_timeline || videoEvidence.keyframe_timeline || [],
        summary: videoEvidence.summary
      } : undefined,
      primaryAnnotatedKeyframeUrl: mlResult.primary_annotated_keyframe_url,
      supportingEvidence: mlResult.keyframe_timeline || []
    },
    humanAssessment: {
      assessor: null,
      action: '',
      reason: '',
      timestamp: null,
      notes: ''
    },
    decision: {
      outcome: 'PENDING',
      reason: '',
      decisionMaker: null,
      timestamp: null
    },
    auditHistory: [
      {
        timestamp: new Date(),
        action: 'CLAIM_SUBMITTED',
        actor: {
          id: actorId,
          name: actorName,
          role: actorRole
        },
        previousStatus: null,
        newStatus: CLAIM_STATUS.SUBMITTED,
        details: 'Physical claim evidence ingested into repository'
      },
      {
        timestamp: new Date(),
        action: 'PROCESSING_STARTED',
        actor: {
          id: 'SYSTEM_ML',
          name: 'Automated Pipeline',
          role: 'SYSTEM'
        },
        previousStatus: CLAIM_STATUS.SUBMITTED,
        newStatus: CLAIM_STATUS.PROCESSING,
        details: 'Dispatched media to computer vision and fraud models'
      },
      {
        timestamp: new Date(),
        action: 'AI_ASSESSMENT_COMPLETED',
        actor: {
          id: 'SYSTEM_ML',
          name: 'InsureAuto AI Pipeline',
          role: 'SYSTEM'
        },
        previousStatus: CLAIM_STATUS.PROCESSING,
        newStatus: CLAIM_STATUS.AI_ASSESSED,
        details: `Inference completed. AI recommendation: ${decisionData.recommendation || 'MANUAL_REVIEW'}`
      },
      {
        timestamp: new Date(),
        action: 'QUEUED_FOR_REVIEW',
        actor: {
          id: 'SYSTEM_ROUTER',
          name: 'Work Distribution Engine',
          role: 'SYSTEM'
        },
        previousStatus: CLAIM_STATUS.AI_ASSESSED,
        newStatus: CLAIM_STATUS.PENDING_REVIEW,
        details: 'Claim placed in assessor inspection queue'
      }
    ],
    claimInfo: {
      date: claimData.claim_date,
      description: claimData.claim_description,
      location: claimData.claim_location || 'Unknown',
      policyId: claimData.policy_id || ''
    },
    metadata: isVideo ? (report.metadata || {}) : (damageAssessment.metadata || {}),
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
        isDuplicate: isVideo ? (fraudAnalysis.video_duplicate_check?.is_duplicate || false) : (fraudAnalysis.is_duplicate || false),
        fraudIndicators: fraudAnalysis.fraud_indicators || []
      },
      consistencyAnalysis: {
        score: consistencyAnalysis.score || decisionData.scores?.consistency || 0,
        isConsistent: consistencyAnalysis.is_consistent !== undefined ? consistencyAnalysis.is_consistent : true,
        explanation: consistencyAnalysis.explanation || ''
      }
    },
    annotatedImagePath: mlResult.annotated_image_url || mlResult.primary_annotated_keyframe_url,
    primaryAnnotatedKeyframeUrl: mlResult.primary_annotated_keyframe_url,
    keyframeSelection: isVideo ? {
      primaryPath: videoEvidence.primary_annotated_keyframe_url || mlResult.primary_annotated_keyframe_url,
      secondaryPath: videoEvidence.secondary_annotated_keyframe_url,
      ranking: mlResult.keyframe_timeline || []
    } : undefined,
    keyframeTimeline: mlResult.keyframe_timeline || []
  });

  await claim.save();
  return claim;
};

const getClaims = async ({ status, recommendation, policy_id, claim_type, search, limit, skip }) => {
  const filter = {};
  if (status) filter.status = status;
  if (recommendation) {
    filter.$or = [
      { 'aiAssessment.recommendation': recommendation },
      { 'decision.recommendation': recommendation }
    ];
  }
  if (policy_id) {
    filter.$or = [
      { 'policy.policyNumber': policy_id },
      { 'claimInfo.policyId': policy_id }
    ];
  }
  if (claim_type) filter.claimType = claim_type;

  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), 'i');
    filter.$or = [
      { claimId: searchRegex },
      { jobId: searchRegex },
      { 'customer.name': searchRegex },
      { 'policy.policyNumber': searchRegex },
      { 'vehicle.registration': searchRegex },
      { 'incident.description': searchRegex },
      { 'incident.location': searchRegex }
    ];
  }

  const claims = await Claim.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .select('-__v');

  const total = await Claim.countDocuments(filter);

  return { total, claims };
};

const getClaimById = async (identifier) => {
  const claim = await Claim.findOne({
    $or: [{ claimId: identifier }, { jobId: identifier }]
  });

  if (!claim) {
    throw ApiError.notFound('Claim not found');
  }

  return claim;
};

const updateClaimStatus = async (identifier, { status, assessorNotes, user }) => {
  const claim = await Claim.findOne({
    $or: [{ claimId: identifier }, { jobId: identifier }]
  });

  if (!claim) {
    throw ApiError.notFound('Claim not found');
  }

  if (!claim.canTransitionTo(status)) {
    throw ApiError.badRequest(`Invalid lifecycle state transition from ${claim.status} to ${status}`);
  }

  const previousStatus = claim.status;
  claim.status = status;

  if (assessorNotes) {
    claim.assessorNotes = assessorNotes;
  }

  claim.humanAssessment = {
    assessor: {
      id: user.userId,
      name: user.name,
      email: user.email
    },
    action: status === 'NEEDS_INFORMATION' ? 'REQUEST_INFORMATION' : status,
    reason: assessorNotes || `Status updated to ${status}`,
    notes: assessorNotes || '',
    timestamp: new Date()
  };

  if (status === 'APPROVED' || status === 'REJECTED') {
    claim.decision = {
      outcome: status,
      reason: assessorNotes || `Claim ${status.toLowerCase()} by assessor`,
      decisionMaker: {
        id: user.userId,
        name: user.name
      },
      timestamp: new Date()
    };
  } else if (status === 'NEEDS_INFORMATION') {
    claim.decision = {
      outcome: 'NEEDS_INFORMATION',
      reason: assessorNotes || 'Supplemental information requested',
      decisionMaker: {
        id: user.userId,
        name: user.name
      },
      timestamp: new Date()
    };
  } else if (status === 'CLOSED') {
    claim.decision.outcome = 'CLOSED';
    claim.decision.timestamp = new Date();
    if (!claim.decision.reason && assessorNotes) {
      claim.decision.reason = assessorNotes;
    }
  }

  claim.auditHistory.push({
    timestamp: new Date(),
    action: 'STATUS_TRANSITION',
    actor: {
      id: user.userId,
      name: user.name,
      role: user.role
    },
    previousStatus,
    newStatus: status,
    details: assessorNotes || ''
  });

  await claim.save();
  return claim;
};

const overrideClaimDecision = async (identifier, { newRecommendation, reason, user }) => {
  const claim = await Claim.findOne({
    $or: [{ claimId: identifier }, { jobId: identifier }]
  });

  if (!claim) {
    throw ApiError.notFound('Claim not found');
  }

  const targetStatus = newRecommendation === 'APPROVE' ? 'APPROVED' :
                       newRecommendation === 'REJECT' ? 'REJECTED' : 'UNDER_REVIEW';

  if (claim.status !== targetStatus && !claim.canTransitionTo(targetStatus)) {
    throw ApiError.badRequest(`Invalid lifecycle state transition from ${claim.status} to ${targetStatus}`);
  }

  const previousStatus = claim.status;
  claim.status = targetStatus;

  claim.assessorOverride = {
    assessorId: user.userId,
    assessorName: user.name,
    previousRecommendation: claim.aiAssessment?.recommendation,
    newRecommendation,
    reason: reason.trim(),
    timestamp: new Date()
  };

  claim.humanAssessment = {
    assessor: {
      id: user.userId,
      name: user.name,
      email: user.email
    },
    action: 'MANUAL_OVERRIDE',
    reason: reason.trim(),
    notes: reason.trim(),
    timestamp: new Date()
  };

  claim.decision = {
    outcome: targetStatus,
    reason: reason.trim(),
    decisionMaker: {
      id: user.userId,
      name: user.name
    },
    timestamp: new Date()
  };

  if (!claim.aiAssessment) {
    claim.aiAssessment = {};
  }
  claim.aiAssessment.recommendation = newRecommendation;

  claim.auditHistory.push({
    timestamp: new Date(),
    action: 'ASSESSOR_OVERRIDE',
    actor: {
      id: user.userId,
      name: user.name,
      role: user.role
    },
    previousStatus,
    newStatus: targetStatus,
    details: `Override to ${newRecommendation}: ${reason.trim()}`
  });

  await claim.save();
  return claim;
};

const getClaimStats = async () => {
  const totalClaims = await Claim.countDocuments();

  const statusCounts = await Claim.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  const recommendationCounts = await Claim.aggregate([
    {
      $group: {
        _id: { $ifNull: ['$aiAssessment.recommendation', '$decision.recommendation'] },
        count: { $sum: 1 }
      }
    }
  ]);

  const claimTypeCounts = await Claim.aggregate([
    { $group: { _id: '$claimType', count: { $sum: 1 } } }
  ]);

  const avgScores = await Claim.aggregate([
    {
      $group: {
        _id: null,
        avgDamageScore: { $avg: { $ifNull: ['$aiAssessment.scores.damage', '$decision.scores.damage'] } },
        avgFraudScore: { $avg: { $ifNull: ['$aiAssessment.scores.fraud', '$decision.scores.fraud'] } },
        avgConsistencyScore: { $avg: { $ifNull: ['$aiAssessment.scores.consistency', '$decision.scores.consistency'] } }
      }
    }
  ]);

  return {
    totalClaims,
    claimTypeDistribution: claimTypeCounts,
    statusDistribution: statusCounts,
    recommendationDistribution: recommendationCounts,
    averageScores: avgScores[0] || {}
  };
};

module.exports = {
  analyzeAndCreateClaim,
  getClaims,
  getClaimById,
  updateClaimStatus,
  overrideClaimDecision,
  getClaimStats
};
