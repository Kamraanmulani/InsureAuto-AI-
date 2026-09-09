const fs = require('fs');
const Claim = require('../models/Claim');
const { CLAIM_STATUS, ALLOWED_TRANSITIONS } = require('../models/Claim');
const { forwardToML } = require('../services/mlService');
const { isVideoFile } = require('../middleware/uploadMiddleware');

const analyzeClaim = async (req, res) => {
  const uploadedFile = req.files && req.files.length > 0 ? req.files[0] : null;

  try {
    const {
      claim_date,
      claim_description,
      claim_location,
      policy_id,
      vehicle_registration,
      vehicle_make,
      vehicle_model,
      vehicle_year,
      incident_type,
      incident_time,
      customer_name,
      customer_email,
      customer_phone
    } = req.body;

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

    const claimId = mlResult.job_id.startsWith('CLM-')
      ? mlResult.job_id
      : `CLM-${mlResult.job_id.slice(0, 8).toUpperCase()}`;

    const claim = new Claim({
      claimId,
      jobId: mlResult.job_id,
      claimType: isVideo ? 'VIDEO_WALK_AROUND' : 'PHOTO_IMAGE',
      status: CLAIM_STATUS.PENDING_REVIEW,
      customer: {
        customerId: `CUST-${(policy_id || '999').replace(/\D/g, '').slice(0, 4) || '101'}`,
        name: customer_name || `Policyholder (${policy_id || 'Unassigned'})`,
        email: customer_email || 'client@insureauto.ai',
        phone: customer_phone || '+1 (555) 019-2831'
      },
      policy: {
        policyNumber: policy_id || 'POL-UNASSIGNED',
        policyType: 'Comprehensive Motor Policy',
        coverageType: 'Full Collision & Comprehensive',
        deductible: '$500',
        effectiveDate: 'Jan 2026'
      },
      vehicle: {
        registration: vehicle_registration || 'UNREGISTERED',
        make: vehicle_make || (report.metadata?.vehicle_make || 'Standard'),
        model: vehicle_model || (report.metadata?.vehicle_model || 'Vehicle'),
        year: vehicle_year ? parseInt(vehicle_year) : 2022,
        vin: `1HGCR2F8${mlResult.job_id.slice(0, 8).toUpperCase()}`
      },
      incident: {
        date: claim_date,
        time: incident_time || '12:00 PM',
        location: claim_location || 'Unknown Location',
        incidentType: incident_type || 'Collision',
        description: claim_description
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
            id: req.user ? req.user.userId : 'INTAKE_SYSTEM',
            name: req.user ? req.user.name : 'Intake Gateway',
            role: req.user ? req.user.role : 'SYSTEM'
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
        date: claim_date,
        description: claim_description,
        location: claim_location || 'Unknown',
        policyId: policy_id || ''
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

    res.json({
      success: true,
      claim
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
    const { status, recommendation, policy_id, claim_type, search, limit = 50, skip = 0 } = req.query;

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
    const identifier = req.params.jobId;
    const claim = await Claim.findOne({
      $or: [{ claimId: identifier }, { jobId: identifier }]
    });
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
    const validStatuses = Object.values(CLAIM_STATUS);

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const identifier = req.params.jobId;
    const claim = await Claim.findOne({
      $or: [{ claimId: identifier }, { jobId: identifier }]
    });

    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    if (!claim.canTransitionTo(status)) {
      return res.status(400).json({
        error: `Invalid lifecycle state transition from ${claim.status} to ${status}`
      });
    }

    const previousStatus = claim.status;
    claim.status = status;

    if (assessorNotes) {
      claim.assessorNotes = assessorNotes;
    }

    claim.humanAssessment = {
      assessor: {
        id: req.user.userId,
        name: req.user.name,
        email: req.user.email
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
          id: req.user.userId,
          name: req.user.name
        },
        timestamp: new Date()
      };
    } else if (status === 'NEEDS_INFORMATION') {
      claim.decision = {
        outcome: 'NEEDS_INFORMATION',
        reason: assessorNotes || 'Supplemental information requested',
        decisionMaker: {
          id: req.user.userId,
          name: req.user.name
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
        id: req.user.userId,
        name: req.user.name,
        role: req.user.role
      },
      previousStatus,
      newStatus: status,
      details: assessorNotes || ''
    });

    await claim.save();

    res.json({
      success: true,
      claim
    });
  } catch (error) {
    if (error.message && error.message.includes('Invalid lifecycle state transition')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to update claim status', details: error.message });
  }
};

const overrideDecision = async (req, res) => {
  try {
    const { newRecommendation, reason } = req.body;
    const validRecommendations = ['APPROVE', 'MANUAL_REVIEW', 'REJECT'];
    if (!validRecommendations.includes(newRecommendation)) {
      return res.status(400).json({ error: 'Invalid recommendation' });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Justification reason is required' });
    }

    const identifier = req.params.jobId;
    const claim = await Claim.findOne({
      $or: [{ claimId: identifier }, { jobId: identifier }]
    });

    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    const targetStatus = newRecommendation === 'APPROVE' ? 'APPROVED' :
                         newRecommendation === 'REJECT' ? 'REJECTED' : 'UNDER_REVIEW';

    if (claim.status !== targetStatus && !claim.canTransitionTo(targetStatus)) {
      return res.status(400).json({
        error: `Invalid lifecycle state transition from ${claim.status} to ${targetStatus}`
      });
    }

    const previousStatus = claim.status;
    claim.status = targetStatus;

    claim.assessorOverride = {
      assessorId: req.user.userId,
      assessorName: req.user.name,
      previousRecommendation: claim.aiAssessment?.recommendation,
      newRecommendation,
      reason: reason.trim(),
      timestamp: new Date()
    };

    claim.humanAssessment = {
      assessor: {
        id: req.user.userId,
        name: req.user.name,
        email: req.user.email
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
        id: req.user.userId,
        name: req.user.name
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
        id: req.user.userId,
        name: req.user.name,
        role: req.user.role
      },
      previousStatus,
      newStatus: targetStatus,
      details: `Override to ${newRecommendation}: ${reason.trim()}`
    });

    await claim.save();

    res.json({
      success: true,
      claim
    });
  } catch (error) {
    if (error.message && error.message.includes('Invalid lifecycle state transition')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to override decision', details: error.message });
  }
};

const getClaimStats = async (req, res) => {
  try {
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
