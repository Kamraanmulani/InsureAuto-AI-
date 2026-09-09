const fs = require('fs');
const Claim = require('../models/Claim');
const { CLAIM_STATUS } = require('../models/Claim');
const ApiError = require('../utils/apiError');
const mlService = require('./mlService');
const { isVideoFile } = require('../middleware/uploadMiddleware');

const processClaimJob = async (identifier) => {
  let claim;
  try {
    claim = await Claim.findOne({
      $or: [{ claimId: identifier }, { jobId: identifier }]
    });

    if (!claim) {
      return null;
    }

    if (claim.status !== CLAIM_STATUS.PROCESSING && claim.status !== CLAIM_STATUS.SUBMITTED) {
      return claim;
    }

    const evidenceItem = claim.evidence && claim.evidence.length > 0 ? claim.evidence[0] : null;
    const filePath = evidenceItem?.rawFilePath || evidenceItem?.fileReference;

    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error(`Evidence media file not found on disk at path: ${filePath}`);
    }

    const isVideo = claim.claimType === 'VIDEO_WALK_AROUND' || (evidenceItem && evidenceItem.type === 'VIDEO');

    const mlResult = await mlService.forwardToML(filePath, evidenceItem.originalName || 'media_file', isVideo, {
      claim_date: claim.incident?.date,
      claim_description: claim.incident?.description,
      claim_location: claim.incident?.location,
      policy_id: claim.policy?.policyNumber
    });

    if (!mlResult || !mlResult.success) {
      throw new Error('ML analysis pipeline returned unsuccessful response');
    }

    const report = mlResult.report || {};
    const damageAssessment = report.damage_assessment || {};
    const fraudAnalysis = report.fraud_analysis || {};
    const consistencyAnalysis = report.consistency_analysis || {};
    const decisionData = mlResult.decision || report.decision || {};
    const videoEvidence = report.video_evidence || {};

    claim.aiAssessment = {
      damageAssessment: {
        available: damageAssessment.available !== undefined ? damageAssessment.available : (damageAssessment.score > 0 || damageAssessment.damage_score > 0),
        status: damageAssessment.status || (damageAssessment.available === false ? 'MODEL_UNAVAILABLE' : 'EVALUATED'),
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
      reasons: decisionData.reasons || [],
      pillarBreakdown: decisionData.pillar_breakdown || undefined,
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
    };

    if (evidenceItem) {
      evidenceItem.processingStatus = 'COMPLETED';
      evidenceItem.error = null;
      evidenceItem.fileReference = mlResult.primary_annotated_keyframe_url || mlResult.annotated_image_url || evidenceItem.fileReference;
      evidenceItem.metadata = isVideo ? (report.metadata || {}) : (damageAssessment.metadata || {});
      evidenceItem.analysisResults = {
        keyframeRanking: mlResult.keyframe_timeline || videoEvidence.keyframe_timeline || [],
        damageAssessment,
        fraudAnalysis,
        consistencyAnalysis
      };
    }

    claim.annotatedImagePath = mlResult.annotated_image_url || mlResult.primary_annotated_keyframe_url;
    claim.primaryAnnotatedKeyframeUrl = mlResult.primary_annotated_keyframe_url;
    claim.keyframeSelection = isVideo ? {
      primaryPath: videoEvidence.primary_annotated_keyframe_url || mlResult.primary_annotated_keyframe_url,
      secondaryPath: videoEvidence.secondary_annotated_keyframe_url,
      ranking: mlResult.keyframe_timeline || []
    } : undefined;
    claim.keyframeTimeline = mlResult.keyframe_timeline || [];

    claim.processingError = {
      message: null,
      details: null,
      timestamp: null,
      retryCount: claim.processingError?.retryCount || 0
    };

    const previousStatus = claim.status;
    claim.status = CLAIM_STATUS.AI_ASSESSED;

    claim.auditHistory.push({
      timestamp: new Date(),
      action: 'AI_ASSESSMENT_COMPLETED',
      actor: {
        id: 'SYSTEM_ML',
        name: 'InsureAuto AI Pipeline',
        role: 'SYSTEM'
      },
      previousStatus,
      newStatus: CLAIM_STATUS.AI_ASSESSED,
      details: `Inference completed successfully. Recommendation: ${decisionData.recommendation || 'MANUAL_REVIEW'}`
    });

    await claim.save();
    return claim;
  } catch (error) {
    if (claim) {
      const errorMsg = error.response?.data?.detail || error.message || 'Processing failed';
      const errorDetail = error.code === 'ECONNREFUSED' ? 'ML service connection refused on port 8000' : (error.response?.data || error.code || null);

      if (claim.evidence && claim.evidence.length > 0) {
        claim.evidence[0].processingStatus = 'FAILED';
        claim.evidence[0].error = errorMsg;
      }

      claim.processingError = {
        message: errorMsg,
        details: errorDetail,
        timestamp: new Date(),
        retryCount: (claim.processingError?.retryCount || 0) + 1
      };

      claim.auditHistory.push({
        timestamp: new Date(),
        action: 'PROCESSING_FAILED',
        actor: {
          id: 'SYSTEM_ML',
          name: 'InsureAuto AI Pipeline',
          role: 'SYSTEM'
        },
        previousStatus: claim.status,
        newStatus: claim.status,
        details: errorMsg
      });

      await claim.save();
    }
    return null;
  }
};

const createClaimAndDispatch = async ({ uploadedFile, claimData, user }) => {
  if (!uploadedFile) {
    throw ApiError.badRequest('Photo or walk-around video file is required');
  }

  const isVideo = isVideoFile(uploadedFile);
  const rawJobId = `job-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
  const claimId = `CLM-${rawJobId.slice(4).toUpperCase()}`;

  const actorId = user ? user.userId : 'INTAKE_SYSTEM';
  const actorName = user ? user.name : 'Intake Gateway';
  const actorRole = user ? user.role : 'SYSTEM';

  const claim = new Claim({
    claimId,
    jobId: rawJobId,
    claimType: isVideo ? 'VIDEO_WALK_AROUND' : 'PHOTO_IMAGE',
    status: CLAIM_STATUS.PROCESSING,
    customer: {
      customerId: claimData.customer_id || (claimData.policy_id ? `CUST-${claimData.policy_id.replace(/\D/g, '').slice(0, 4) || '101'}` : 'CUST-UNASSIGNED'),
      name: claimData.customer_name || claimData.policy_holder_name || 'Policyholder',
      email: claimData.customer_email || '',
      phone: claimData.customer_phone || ''
    },
    policy: {
      policyNumber: claimData.policy_id || 'POL-UNASSIGNED',
      policyType: claimData.policy_type || 'Comprehensive Motor Policy',
      coverageType: claimData.coverage_type || 'Full Collision & Comprehensive',
      deductible: claimData.deductible || '$500',
      effectiveDate: claimData.effective_date || 'Jan 2026'
    },
    vehicle: {
      registration: claimData.vehicle_registration || 'UNREGISTERED',
      make: claimData.vehicle_make || 'Standard',
      model: claimData.vehicle_model || 'Vehicle',
      year: claimData.vehicle_year ? parseInt(claimData.vehicle_year, 10) : 2022,
      vin: claimData.vehicle_vin || null
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
      fileReference: uploadedFile.path,
      rawFilePath: uploadedFile.path,
      originalName: uploadedFile.originalname,
      uploadTimestamp: new Date(),
      metadata: {},
      processingStatus: 'PROCESSING',
      analysisResults: {}
    }],
    aiAssessment: {
      recommendation: 'MANUAL_REVIEW',
      confidence: 'MEDIUM',
      explanation: 'Analysis in progress'
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
    processingError: {
      message: null,
      details: null,
      timestamp: null,
      retryCount: 0
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
          id: 'SYSTEM_JOB_RUNNER',
          name: 'Claim Intake Dispatcher',
          role: 'SYSTEM'
        },
        previousStatus: CLAIM_STATUS.SUBMITTED,
        newStatus: CLAIM_STATUS.PROCESSING,
        details: 'Dispatched evidence to asynchronous multi-modal processing worker'
      }
    ],
    claimInfo: {
      date: claimData.claim_date,
      description: claimData.claim_description,
      location: claimData.claim_location || 'Unknown',
      policyId: claimData.policy_id || ''
    }
  });

  await claim.save();

  setImmediate(() => {
    processClaimJob(claim.claimId);
  });

  return claim;
};

const retryClaimProcessing = async (identifier, user) => {
  const claim = await Claim.findOne({
    $or: [{ claimId: identifier }, { jobId: identifier }]
  });

  if (!claim) {
    throw ApiError.notFound('Claim not found');
  }

  if (['APPROVED', 'REJECTED', 'CLOSED'].includes(claim.status)) {
    throw ApiError.badRequest(`Cannot retry processing for claim in terminal or resolved status '${claim.status}'`);
  }

  const actorId = user ? user.userId : 'SYSTEM_RETRY';
  const actorName = user ? user.name : 'Assessor Console';
  const actorRole = user ? user.role : 'ASSESSOR';

  const previousStatus = claim.status;
  claim.status = CLAIM_STATUS.PROCESSING;

  if (claim.evidence && claim.evidence.length > 0) {
    claim.evidence[0].processingStatus = 'PROCESSING';
    claim.evidence[0].error = null;
  }

  claim.processingError = {
    message: null,
    details: null,
    timestamp: null,
    retryCount: (claim.processingError?.retryCount || 0) + 1
  };

  claim.auditHistory.push({
    timestamp: new Date(),
    action: 'PROCESSING_RETRY_INITIATED',
    actor: {
      id: actorId,
      name: actorName,
      role: actorRole
    },
    previousStatus,
    newStatus: CLAIM_STATUS.PROCESSING,
    details: 'Assessor requested reprocessing of evidence analysis pipeline'
  });

  await claim.save();

  setImmediate(() => {
    processClaimJob(claim.claimId);
  });

  return claim;
};

const getProcessingStatus = async (identifier) => {
  const claim = await Claim.findOne({
    $or: [{ claimId: identifier }, { jobId: identifier }]
  });

  if (!claim) {
    throw ApiError.notFound('Claim not found');
  }

  const evidenceItem = claim.evidence && claim.evidence.length > 0 ? claim.evidence[0] : null;

  return {
    claimId: claim.claimId,
    jobId: claim.jobId,
    status: claim.status,
    processingStatus: evidenceItem?.processingStatus || 'COMPLETED',
    processingError: claim.processingError,
    evidence: claim.evidence,
    aiAssessment: claim.status === CLAIM_STATUS.AI_ASSESSED || claim.aiAssessment?.scores?.damage !== undefined
      ? claim.aiAssessment
      : null
  };
};

const getClaims = async ({ status, recommendation, policy_id, claim_type, search, limit, skip }) => {
  const filter = {};
  const andConditions = [];

  if (status) filter.status = status;
  if (claim_type) filter.claimType = claim_type;

  if (recommendation) {
    andConditions.push({
      $or: [
        { 'aiAssessment.recommendation': recommendation },
        { 'decision.recommendation': recommendation }
      ]
    });
  }

  if (policy_id) {
    andConditions.push({
      $or: [
        { 'policy.policyNumber': policy_id },
        { 'claimInfo.policyId': policy_id }
      ]
    });
  }

  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), 'i');
    andConditions.push({
      $or: [
        { claimId: searchRegex },
        { jobId: searchRegex },
        { 'customer.name': searchRegex },
        { 'policy.policyNumber': searchRegex },
        { 'vehicle.registration': searchRegex },
        { 'incident.description': searchRegex },
        { 'incident.location': searchRegex }
      ]
    });
  }

  if (andConditions.length > 0) {
    filter.$and = andConditions;
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
  createClaimAndDispatch,
  processClaimJob,
  retryClaimProcessing,
  getProcessingStatus,
  getClaims,
  getClaimById,
  updateClaimStatus,
  overrideClaimDecision,
  getClaimStats
};
