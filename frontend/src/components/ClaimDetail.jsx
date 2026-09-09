import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  ChevronDown, ChevronUp, Car, AlertTriangle, ShieldCheck, User, Layers, RefreshCw,
  Info, HelpCircle, CheckCircle2, XCircle, AlertCircle, FileText, Camera, Database,
  Sparkles, ShieldAlert, Wrench
} from 'lucide-react';
import { claimAPI } from '../services/api';
import { CLAIM_STATUS, formatClaimId } from '../types/claim';

const ClaimDetail = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [claim, setClaim] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeFrameType, setActiveFrameType] = useState('primary');
  const [showTechnicalAnalysis, setShowTechnicalAnalysis] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [overrideData, setOverrideData] = useState({
    newRecommendation: '',
    reason: ''
  });
  const [showReqInfoModal, setShowReqInfoModal] = useState(false);
  const [reqInfoNotes, setReqInfoNotes] = useState('');

  const loadClaim = useCallback(async () => {
    try {
      setLoading(true);
      const response = await claimAPI.getClaim(jobId);
      setClaim(response.claim);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load claim data.');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    loadClaim();
  }, [loadClaim]);

  useEffect(() => {
    if (!claim || claim.status !== CLAIM_STATUS.PROCESSING || claim.processingError?.message) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const res = await claimAPI.getClaim(jobId);
        if (res?.claim) {
          setClaim(res.claim);
          if (res.claim.status !== CLAIM_STATUS.PROCESSING || res.claim.processingError?.message) {
            clearInterval(interval);
          }
        }
      } catch (err) {
        clearInterval(interval);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [claim, jobId]);

  const handleRetryProcessing = async () => {
    try {
      setRetrying(true);
      const res = await claimAPI.retryProcessing(claim?.claimId || claim?.jobId || jobId);
      toast.success('Analysis reprocessing initiated.');
      if (res?.claim) {
        setClaim(res.claim);
      } else {
        await loadClaim();
      }
    } catch (error) {
      console.error(error);
      const msg = error.response?.data?.error || 'Failed to retry claim processing.';
      toast.error(msg);
    } finally {
      setRetrying(false);
    }
  };

  const handleDecisionAction = async (targetStatus, notes = '') => {
    try {
      setActionLoading(true);
      await claimAPI.updateStatus(claim?.claimId || claim?.jobId || jobId, targetStatus, notes);
      toast.success(`Claim status transitioned to ${targetStatus}.`);
      await loadClaim();
    } catch (error) {
      console.error(error);
      const msg = error.response?.data?.error || 'Failed to update claim status.';
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOverrideSubmit = async (e) => {
    e.preventDefault();
    if (!overrideData.newRecommendation) {
      toast.error('Please select an override decision.');
      return;
    }
    if (!overrideData.reason.trim()) {
      toast.error('Justification rationale is mandatory for manual override.');
      return;
    }

    try {
      setActionLoading(true);
      await claimAPI.overrideDecision(
        claim?.claimId || claim?.jobId || jobId,
        overrideData.newRecommendation,
        overrideData.reason
      );
      toast.success('Assessor decision override recorded successfully.');
      setShowOverrideDialog(false);
      setOverrideData({ newRecommendation: '', reason: '' });
      await loadClaim();
    } catch (error) {
      console.error(error);
      const msg = error.response?.data?.error || 'Failed to record decision override.';
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestInfoSubmit = async (e) => {
    e.preventDefault();
    if (!reqInfoNotes.trim()) {
      toast.error('Please describe what information is requested.');
      return;
    }
    await handleDecisionAction(CLAIM_STATUS.NEEDS_INFORMATION, reqInfoNotes);
    setShowReqInfoModal(false);
    setReqInfoNotes('');
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <p className="text-xs text-slate-500">Loading claim investigation record...</p>
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="bg-white border border-slate-200 rounded p-8 text-center max-w-lg mx-auto my-12">
        <h2 className="text-base font-semibold text-slate-900">Claim Record Not Found</h2>
        <p className="text-xs text-slate-500 mt-1">No claim found matching ID: {jobId}</p>
        <button
          type="button"
          onClick={() => navigate('/claims')}
          className="mt-4 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded hover:bg-slate-800"
        >
          Return to Claims Queue
        </button>
      </div>
    );
  }

  const ML_API_URL = process.env.REACT_APP_ML_API_URL || 'http://localhost:8000';
  const isVideoClaim = claim.claimType === 'VIDEO_WALK_AROUND' || !!claim.keyframeSelection;
  const keyframeInfo = claim.aiAssessment?.keyframeSelection || claim.keyframeSelection || {};
  const damage = claim.aiAssessment?.damageAssessment || claim.analysis?.damageAssessment || {};
  const fraud = claim.aiAssessment?.fraudAssessment || claim.analysis?.fraudAnalysis || {};
  const consistency = claim.aiAssessment?.consistencyAssessment || claim.analysis?.consistencyAnalysis || {};
  const aiRecommendation = claim.aiAssessment?.recommendation || claim.decision?.recommendation || 'MANUAL_REVIEW';
  const rawConfidence = claim.aiAssessment?.confidence || claim.decision?.confidence;
  const aiConfidence = ['HIGH', 'MEDIUM', 'LOW'].includes(String(rawConfidence).toUpperCase())
    ? String(rawConfidence).toUpperCase()
    : null;
  const aiExplanation = claim.aiAssessment?.explanation || claim.decision?.explanation || '';
  const aiReasons = claim.aiAssessment?.reasons || claim.decision?.reasons || [];
  const scores = claim.aiAssessment?.scores || claim.decision?.scores || { damage: 0, fraud: 0, consistency: 0 };
  const yoloAggregate = damage.yoloAggregate || {};
  const videoDup = fraud.videoDuplicateCheck || {};
  const metaFraud = fraud.metadataFraud || {};
  const pillarBreakdown = claim.aiAssessment?.pillarBreakdown || {};

  const damageScore = Number(scores.damage || 0);
  const fraudScore = Number(scores.fraud || 0);
  const consistencyScore = Number(scores.consistency || 0);
  const fraudScoreOutOf100 = Math.min(100, Math.max(0, Math.round(fraudScore * 10)));

  const vehicle = claim.vehicle || {
    make: 'Standard',
    model: 'Sedan',
    year: 2022,
    registration: 'UNREGISTERED',
    vin: 'N/A'
  };

  const incident = claim.incident || {
    date: claim.claimInfo?.date || 'N/A',
    time: '12:00 PM',
    location: claim.claimInfo?.location || 'Unknown',
    incidentType: 'Collision',
    description: claim.claimInfo?.description || 'N/A'
  };

  const policy = claim.policy || {
    policyNumber: claim.claimInfo?.policyId || 'POL-UNASSIGNED',
    policyType: 'Comprehensive Motor',
    coverageType: 'Standard Collision',
    deductible: '$500',
    effectiveDate: ''
  };

  const customer = claim.customer || {
    customerId: 'CUST-UNASSIGNED',
    name: 'Policyholder',
    email: 'client@insureauto.ai',
    phone: 'N/A'
  };

  const evidenceList = Array.isArray(claim.evidence) && claim.evidence.length > 0
    ? claim.evidence
    : [{
        type: isVideoClaim ? 'VIDEO' : 'PHOTO',
        fileReference: claim.annotatedImagePath || claim.primaryAnnotatedKeyframeUrl || 'primary_evidence',
        uploadTimestamp: claim.createdAt,
        processingStatus: 'COMPLETED'
      }];

  const humanAssessment = claim.humanAssessment || {};
  const decision = claim.decision || { outcome: 'PENDING' };
  const auditHistory = claim.auditHistory || [];
  const claimCode = formatClaimId(claim);
  const isProcessing = claim.status === CLAIM_STATUS.PROCESSING;
  const hasProcessingError = !!claim.processingError?.message;

  const fraudLevel = fraud.riskLevel || (fraudScore >= 7 ? 'HIGH' : fraudScore >= 4 ? 'MEDIUM' : 'LOW');
  const fraudWhatItMeans = fraudLevel === 'LOW'
    ? 'Minimal probability of fraudulent fabrication, duplicate submission, or file alteration. Standard claim handling path is recommended.'
    : fraudLevel === 'HIGH'
    ? 'Elevated fraud signals detected. High probability of duplicate footage, digital alteration, or policy abuse. Special investigation recommended.'
    : 'Moderate risk indicators flagged. Assessor should review metadata, timestamps, and physical photo characteristics before settlement.';

  const isDuplicateDetected = Boolean(fraud.isDuplicate || videoDup.isDuplicate || (videoDup.similarityScore && videoDup.similarityScore >= 0.88));
  const duplicateSimPct = videoDup.similarityScore ? Math.round(videoDup.similarityScore * 100) : null;
  const editingDetected = Boolean(metaFraud.editingSoftwareDetected);
  const editingTools = metaFraud.editingTools || [];
  const dateDiffDays = pillarBreakdown.metadata_risk?.date_difference_days;

  const fraudReasons = [
    isDuplicateDetected
      ? {
          text: `Duplicate evidence detected across historical claims repository${duplicateSimPct ? ` (${duplicateSimPct}% similarity)` : ''}`,
          evidenceType: 'Perceptual Hash Index',
          isFlag: true
        }
      : {
          text: 'No duplicate evidence detected across historical claims database',
          evidenceType: 'Perceptual Hash Verification',
          isFlag: false
        },
    editingDetected
      ? {
          text: `Digital editing software signature identified (${editingTools.length > 0 ? editingTools.join(', ') : 'Modified media signature'})`,
          evidenceType: 'File EXIF / Container Metadata',
          isFlag: true
        }
      : {
          text: 'No significant metadata anomaly or digital editing software signature detected',
          evidenceType: 'File EXIF / Container Metadata',
          isFlag: false
        },
    dateDiffDays && dateDiffDays > 7
      ? {
          text: `Evidence creation timestamp differs from reported incident date by ${dateDiffDays} days`,
          evidenceType: 'Timeline Correlation',
          isFlag: true
        }
      : {
          text: 'Evidence capture timestamp aligns with reported incident timeline',
          evidenceType: 'Timeline Correlation',
          isFlag: false
        },
    consistency.isConsistent !== false && consistencyScore >= 4
      ? {
          text: 'Claim description is consistent with visual evidence',
          evidenceType: 'Claim Narrative vs Visual Evidence',
          isFlag: false
        }
      : {
          text: 'Visual damage pattern exhibits inconsistency with claimant narrative',
          evidenceType: 'Claim Narrative vs Visual Evidence',
          isFlag: true
        },
    ...(Array.isArray(fraud.fraudIndicators) ? fraud.fraudIndicators.map(ind => ({
      text: ind,
      evidenceType: 'Anti-Fraud Pattern Match',
      isFlag: true
    })) : [])
  ];

  const isDamageModelUnavailable = damage.available === false || damage.status === 'MODEL_UNAVAILABLE';
  const damageSeverity = isDamageModelUnavailable
    ? 'Dedicated Model Unavailable'
    : (damage.severity || (damageScore >= 7.5 ? 'Severe' : damageScore >= 4 ? 'Moderate' : 'Minor'));

  const damageWhatItMeans = isDamageModelUnavailable
    ? 'Vehicle detected. Dedicated damage model unavailable. Physical damage is not derived from vehicle detection confidence. Manual adjuster review required.'
    : damageScore < 4
    ? 'Superficial exterior or localized panel damage. Eligible for standard body shop repair estimate without major structural teardown.'
    : damageScore >= 7.5
    ? 'Severe structural or multi-panel crumple. High likelihood of structural deformation or total loss threshold evaluation.'
    : 'Substantial body or bumper damage. Involves component replacement or realignment requiring professional estimator review.';

  const damageReasons = isDamageModelUnavailable
    ? [
        {
          text: 'Vehicle detected. Dedicated damage model unavailable.',
          evidenceType: 'Model Architecture Guardrail',
          isFlag: false
        },
        damage.description
          ? {
              text: damage.description,
              evidenceType: 'Claimant Narrative (Triage)',
              isFlag: false
            }
          : null,
        {
          text: `Vehicle localized and verified against policy (${vehicle.year} ${vehicle.make} ${vehicle.model}, Plate ${vehicle.registration})`,
          evidenceType: 'Policy Vehicle Reference',
          isFlag: false
        }
      ].filter(Boolean)
    : [
        damage.damagedParts && damage.damagedParts.length > 0
          ? {
              text: `Identified damage localized to: ${damage.damagedParts.join(', ')}`,
              evidenceType: 'Visual Inspection Frame',
              isFlag: false
            }
          : {
              text: 'No primary structural panel failure localized in inspection frame',
              evidenceType: 'Visual Inspection Frame',
              isFlag: false
            },
        {
          text: `Recommended repair path: ${damage.recommendation || 'Standard Body Repair & Alignment'}`,
          evidenceType: 'Damage Classification Engine',
          isFlag: false
        },
        damage.description
          ? {
              text: `Observed impact: ${damage.description}`,
              evidenceType: 'Visual Evidence Analysis',
              isFlag: false
            }
          : null,
        {
          text: `Vehicle profile verified against policy (${vehicle.year} ${vehicle.make} ${vehicle.model}, Plate ${vehicle.registration})`,
          evidenceType: 'Policy Vehicle Reference',
          isFlag: false
        }
      ].filter(Boolean);

  const consistencyRating = consistencyScore >= 7 ? 'High Consistency' : consistencyScore >= 4 ? 'Moderate Alignment' : 'Inconsistent';
  const consistencyWhatItMeans = consistencyScore >= 7
    ? 'The claimant\'s incident description closely matches the visible damage location, severity, and collision dynamics.'
    : consistencyScore < 4
    ? 'Substantial contradiction between how the accident was described and what the visual evidence reveals.'
    : 'Minor ambiguities between the written description and visible damages. Assessor should review specifics with claimant.';

  const consistencyReasons = [
    {
      text: consistency.explanation || (consistencyScore >= 7 ? 'Visual damage pattern corresponds with stated collision description' : 'Discrepancy observed between described impact and visible vehicle damage'),
      evidenceType: 'Narrative vs Visual Evidence',
      isFlag: consistencyScore < 4
    },
    {
      text: `Reported incident type (${incident.incidentType}) evaluated against observed physical damage distribution`,
      evidenceType: 'Incident Information',
      isFlag: false
    },
    {
      text: `Claimant stated: "${incident.description?.slice(0, 100)}${incident.description?.length > 100 ? '...' : ''}"`,
      evidenceType: 'Claimant Submission',
      isFlag: false
    }
  ];

  const recommendationWhatItMeans = aiRecommendation === 'APPROVE'
    ? 'The advisory models found low fraud risk, high narrative consistency, and documented damage within expected thresholds. Recommended for expedited adjuster approval.'
    : aiRecommendation === 'REJECT'
    ? 'Critical risk factors (such as duplicate evidence, digital file tampering, or severe narrative contradiction) were identified. Suggests denial consideration or referral to SIU.'
    : 'The claim contains elements requiring human adjuster discretion—such as repair valuation, moderate severity, or edge-case damage patterns—before a decision.';

  const recommendationReasons = aiReasons.length > 0
    ? aiReasons.map(r => ({ text: r, evidenceType: 'Decision Engine Analysis' }))
    : [
        { text: `Fraud Risk evaluated as ${fraudLevel} (${fraudScoreOutOf100}/100)`, evidenceType: 'Anti-Fraud System' },
        { text: `Physical Damage categorized as ${damageSeverity} severity (${damageScore.toFixed(1)}/10)`, evidenceType: 'Damage Assessment Engine' },
        { text: `Narrative consistency evaluated at ${consistencyScore.toFixed(1)}/10 (${consistencyRating})`, evidenceType: 'Multi-Modal Consistency' }
      ];

  const getDisplayImageUrl = () => {
    if (!isVideoClaim) {
      return claim.annotatedImagePath ? `${ML_API_URL}${claim.annotatedImagePath}` : `${ML_API_URL}/api/annotated-image/${claim.jobId}`;
    }
    if (activeFrameType === 'secondary' && keyframeInfo.secondaryPath) {
      return `${ML_API_URL}/api/annotated-keyframe/${claim.jobId}?frame_type=secondary`;
    }
    return `${ML_API_URL}/api/annotated-keyframe/${claim.jobId}?frame_type=primary`;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case CLAIM_STATUS.SUBMITTED:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">Submitted</span>;
      case CLAIM_STATUS.PROCESSING:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200">Processing</span>;
      case CLAIM_STATUS.AI_ASSESSED:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-800 border border-indigo-200">AI Assessed</span>;
      case CLAIM_STATUS.PENDING_REVIEW:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">Pending Review</span>;
      case CLAIM_STATUS.UNDER_REVIEW:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-800 border border-blue-300 font-semibold">Under Review</span>;
      case CLAIM_STATUS.APPROVED:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">Approved</span>;
      case CLAIM_STATUS.REJECTED:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-50 text-rose-800 border border-rose-200 font-semibold">Rejected</span>;
      case CLAIM_STATUS.NEEDS_INFORMATION:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-50 text-orange-800 border border-orange-200">Needs Info</span>;
      case CLAIM_STATUS.CLOSED:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-800 border border-slate-300">Closed</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="text-xs text-slate-500 flex items-center gap-1.5">
        <Link to="/claims" className="hover:text-slate-900 transition">Claims</Link>
        <span>/</span>
        <span className="text-slate-900 font-mono font-medium">{claimCode}</span>
      </div>

      <div className="bg-white border border-slate-200 rounded p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900 font-mono">
                {claimCode}
              </h1>
              {getStatusBadge(claim.status)}
              <span className="text-xs text-slate-500 font-normal">
                {isVideoClaim ? 'Walk-Around Video Evidence' : 'Photo Evidence'}
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Submitted: {new Date(claim.createdAt).toLocaleDateString()} at {new Date(claim.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Policyholder: <span className="font-semibold text-slate-800">{customer.name}</span> ({customer.customerId || 'ID Unassigned'})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-slate-600 border-t lg:border-t-0 pt-3 lg:pt-0">
            <div>
              <span className="text-slate-400 block text-[11px]">Policy Number</span>
              <span className="font-semibold text-slate-800 font-mono">{policy.policyNumber}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Insured Vehicle</span>
              <span className="font-semibold text-slate-800">{vehicle.year} {vehicle.make} {vehicle.model}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Plate / Registration</span>
              <span className="font-semibold text-slate-800 font-mono">{vehicle.registration}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Incident Date</span>
              <span className="font-semibold text-slate-800">{incident.date}</span>
            </div>
          </div>
        </div>
      </div>

      {isProcessing && !hasProcessingError && (
        <div className="bg-blue-50 border border-blue-200 rounded p-4 flex items-center justify-between text-xs text-blue-900">
          <div className="flex items-center gap-3">
            <RefreshCw className="animate-spin text-blue-600" size={18} />
            <div>
              <div className="font-semibold">AI Multi-Modal Analysis in Progress</div>
              <p className="text-blue-700 text-[11px] mt-0.5">
                YOLO keyframe detection, VLM damage classification, and fraud verification are processing asynchronously. This view updates automatically.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadClaim}
            className="px-3 py-1.5 bg-white hover:bg-blue-100 text-blue-800 border border-blue-300 rounded text-xs font-medium transition"
          >
            Check Status
          </button>
        </div>
      )}

      {hasProcessingError && (
        <div className="bg-rose-50 border border-rose-200 rounded p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-rose-900">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={18} />
            <div>
              <div className="font-semibold">ML Processing Failed</div>
              <p className="text-rose-700 text-[11px] mt-0.5">
                {claim.processingError.message}
              </p>
              {claim.processingError.retryCount > 0 && (
                <span className="text-[10px] text-rose-500 mt-1 block">
                  Attempts recorded: {claim.processingError.retryCount}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            disabled={retrying}
            onClick={handleRetryProcessing}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-medium transition shrink-0 disabled:opacity-50"
          >
            {retrying ? 'Initiating Retry...' : 'Retry Processing'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-slate-200 rounded p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Physical Evidence Viewer</h2>
                <p className="text-xs text-slate-500">Visual damage assessment with object localization.</p>
              </div>

              {isVideoClaim && (
                <div className="flex items-center gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveFrameType('primary')}
                    className={`px-2.5 py-1 rounded border ${
                      activeFrameType === 'primary'
                        ? 'bg-slate-900 text-white border-slate-900 font-medium'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Primary Keyframe
                  </button>
                  {keyframeInfo.secondaryPath && (
                    <button
                      type="button"
                      onClick={() => setActiveFrameType('secondary')}
                      className={`px-2.5 py-1 rounded border ${
                        activeFrameType === 'secondary'
                          ? 'bg-slate-900 text-white border-slate-900 font-medium'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Secondary Angle
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="bg-slate-100 rounded border border-slate-200 flex items-center justify-center min-h-[360px] overflow-hidden">
              <img
                src={getDisplayImageUrl()}
                alt="Damage inspection frame"
                className="max-h-[460px] w-full object-contain"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250"><rect width="400" height="250" fill="%23f1f5f9"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="12" fill="%2364748b">Visual evidence rendering in background</text></svg>';
                }}
              />
            </div>

            {isVideoClaim && keyframeInfo.ranking && keyframeInfo.ranking.length > 0 && (
              <div className="pt-2">
                <div className="text-xs font-semibold text-slate-700 mb-2">Keyframe Salience Timeline</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {keyframeInfo.ranking.slice(0, 4).map((frame, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded border text-xs ${
                        frame.rank === 1
                          ? 'border-blue-400 bg-blue-50/50'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div className="flex justify-between items-center text-[11px] font-medium text-slate-800">
                        <span>Rank #{frame.rank}</span>
                        <span className="text-slate-500 font-mono">{frame.timestamp_sec}s</span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-600 flex justify-between">
                        <span>Salience:</span>
                        <span className="font-semibold text-slate-800">{frame.salience_score}</span>
                      </div>
                      <div className="text-[11px] text-slate-600 flex justify-between">
                        <span>Detections:</span>
                        <span className="font-semibold text-slate-800">{frame.num_detections}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                <Layers size={14} className="text-slate-500" /> Evidence Inventory
              </h3>
              <span className="text-[11px] text-slate-500">{evidenceList.length} Item(s) Uploaded</span>
            </div>
            <div className="space-y-2">
              {evidenceList.map((item, idx) => (
                <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-800 font-mono">
                      {item.type || 'PHOTO'} Evidence #{idx + 1}
                    </span>
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      item.processingStatus === 'COMPLETED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : item.processingStatus === 'FAILED'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {item.processingStatus || 'COMPLETED'}
                    </span>
                  </div>
                  <div className="text-slate-600 text-[11px] flex justify-between">
                    <span className="text-slate-400">Reference:</span>
                    <span className="font-mono text-slate-700 truncate max-w-[280px]">{item.fileReference || item.originalName || 'evidence_file'}</span>
                  </div>
                  <div className="text-slate-600 text-[11px] flex justify-between">
                    <span className="text-slate-400">Timestamp:</span>
                    <span className="text-slate-700">{item.uploadTimestamp ? new Date(item.uploadTimestamp).toLocaleString() : 'N/A'}</span>
                  </div>
                  {item.error && (
                    <div className="text-rose-600 text-[11px] pt-1">
                      Error: {item.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded p-4 space-y-2 text-xs">
              <h3 className="font-semibold text-slate-900 border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                <Car size={14} className="text-slate-500" /> Vehicle Information
              </h3>
              <div className="space-y-1.5 text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-400">Registration:</span>
                  <span className="font-mono font-medium text-slate-900">{vehicle.registration}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Make & Model:</span>
                  <span className="font-medium text-slate-800">{vehicle.year} {vehicle.make} {vehicle.model}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Year:</span>
                  <span className="text-slate-800">{vehicle.year}</span>
                </div>
                {vehicle.vin && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">VIN:</span>
                    <span className="font-mono text-slate-700 truncate max-w-[150px]">{vehicle.vin}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded p-4 space-y-2 text-xs">
              <h3 className="font-semibold text-slate-900 border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-slate-500" /> Incident Information
              </h3>
              <div className="space-y-1.5 text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-400">Date & Time:</span>
                  <span className="font-medium text-slate-800">{incident.date} at {incident.time}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Incident Type:</span>
                  <span className="font-medium text-slate-800">{incident.incidentType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Location:</span>
                  <span className="text-slate-800 truncate max-w-[150px]">{incident.location}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded p-4 space-y-2 text-xs">
              <h3 className="font-semibold text-slate-900 border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                <User size={14} className="text-slate-500" /> Customer Information
              </h3>
              <div className="space-y-1.5 text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-400">Customer ID:</span>
                  <span className="font-mono font-medium text-slate-900">{customer.customerId || 'CUST-UNASSIGNED'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Full Name:</span>
                  <span className="font-medium text-slate-800">{customer.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Email:</span>
                  <span className="text-slate-800 truncate max-w-[150px]">{customer.email || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Phone:</span>
                  <span className="text-slate-800">{customer.phone || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded p-4 space-y-2 text-xs">
              <h3 className="font-semibold text-slate-900 border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-slate-500" /> Policy Information
              </h3>
              <div className="space-y-1.5 text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-400">Policy Number:</span>
                  <span className="font-mono font-medium text-slate-900">{policy.policyNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Policy Type:</span>
                  <span className="font-medium text-slate-800">{policy.policyType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Coverage Type:</span>
                  <span className="text-slate-800">{policy.coverageType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Deductible:</span>
                  <span className="font-semibold text-slate-900">{policy.deductible}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded p-5 space-y-2">
            <h3 className="text-xs font-semibold text-slate-800">Claimant Incident Description</h3>
            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded border border-slate-200 leading-relaxed">
              "{incident.description}"
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Audit History</h2>
            <div className="divide-y divide-slate-100 text-xs">
              {auditHistory.length === 0 ? (
                <p className="text-slate-500 py-2">No audit entries recorded.</p>
              ) : (
                auditHistory.slice().reverse().map((entry, idx) => (
                  <div key={idx} className="py-2.5 first:pt-0">
                    <div className="flex justify-between text-slate-800 font-medium">
                      <span>{entry.action?.replace(/_/g, ' ')}</span>
                      <span className="text-slate-400 font-normal">
                        {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'N/A'}
                      </span>
                    </div>
                    <p className="text-slate-600 text-[11px] mt-0.5">
                      Actor: <span className="font-medium text-slate-800">{entry.actor?.name || 'System'}</span> ({entry.actor?.role || 'SYSTEM'})
                      {entry.newStatus && <span> • State: <span className="font-mono">{entry.previousStatus || 'INIT'} &rarr; {entry.newStatus}</span></span>}
                    </p>
                    {entry.details && (
                      <p className="text-slate-500 text-[11px] mt-0.5 italic">{entry.details}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-slate-200 rounded p-5 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-indigo-600" />
                  <h2 className="text-sm font-semibold text-slate-900">AI Assessor Assistant</h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Advisory Guidance
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Evidence-based decision support. The claims assessor retains complete adjudication authority.
                </p>
              </div>
            </div>

            {isProcessing && !claim.aiAssessment?.scores?.damage ? (
              <div className="p-4 rounded border bg-slate-50 border-slate-200 text-slate-600 text-xs text-center space-y-2">
                <RefreshCw className="animate-spin mx-auto text-slate-400" size={20} />
                <p className="font-medium text-slate-800">Assessment In Progress</p>
                <p className="text-[11px] text-slate-500">Model inference and evidence reasoning are processing asynchronously.</p>
              </div>
            ) : (
              <>
                <div className={`p-4 rounded border ${
                  aiRecommendation === 'APPROVE'
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                    : aiRecommendation === 'REJECT'
                    ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                    : 'bg-amber-50/70 border-amber-200 text-amber-950'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 font-semibold text-xs">
                      <span>Advisory Recommendation:</span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        aiRecommendation === 'APPROVE'
                          ? 'bg-emerald-600 text-white'
                          : aiRecommendation === 'REJECT'
                          ? 'bg-rose-600 text-white'
                          : 'bg-amber-600 text-white'
                      }`}>
                        {aiRecommendation}
                      </span>
                    </div>
                    {aiConfidence && (
                      <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded bg-white/80 border border-current/20">
                        {aiConfidence} Confidence
                      </span>
                    )}
                  </div>

                  <div className="space-y-2.5 text-xs pt-1">
                    <div>
                      <div className="font-semibold text-[11px] uppercase tracking-wider opacity-80 mb-0.5">What does this mean?</div>
                      <p className="leading-relaxed text-xs">{recommendationWhatItMeans}</p>
                    </div>

                    <div>
                      <div className="font-semibold text-[11px] uppercase tracking-wider opacity-80 mb-1">Why did the system produce this result?</div>
                      <ul className="space-y-1 text-xs">
                        {recommendationReasons.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="shrink-0 mt-0.5">•</span>
                            <div className="flex-1">
                              <span>{item.text}</span>
                              {item.evidenceType && (
                                <span className="ml-1.5 inline-flex items-center text-[10px] text-slate-600 bg-white/80 px-1.5 py-0.5 rounded border border-slate-300">
                                  Evidence: {item.evidenceType}
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <ShieldAlert size={15} className={fraudScore >= 7 ? 'text-rose-600' : fraudScore >= 4 ? 'text-amber-600' : 'text-emerald-600'} />
                      <span className="text-xs font-semibold text-slate-900">Fraud Risk</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        fraudLevel === 'HIGH'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : fraudLevel === 'MEDIUM'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}>
                        {fraudLevel}
                      </span>
                      <span className="text-xs font-bold text-slate-900 font-mono">
                        {fraudScoreOutOf100}/100
                      </span>
                    </div>
                  </div>

                  <div className="w-full bg-slate-200 rounded h-1.5 overflow-hidden">
                    <div
                      className={`h-1.5 rounded ${
                        fraudScore >= 7 ? 'bg-rose-600' : fraudScore >= 4 ? 'bg-amber-500' : 'bg-emerald-600'
                      }`}
                      style={{ width: `${Math.min(100, fraudScoreOutOf100)}%` }}
                    />
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-0.5">What does this mean?</div>
                      <p className="text-slate-600 leading-relaxed text-xs">{fraudWhatItMeans}</p>
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">Why did the system produce this result?</div>
                      <ul className="space-y-1.5">
                        {fraudReasons.map((reason, idx) => (
                          <li key={idx} className="flex items-start gap-1.5 text-slate-700">
                            {reason.isFlag ? (
                              <AlertCircle size={13} className="text-rose-500 shrink-0 mt-0.5" />
                            ) : (
                              <CheckCircle2 size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1 text-[11px] leading-snug">
                              <span>{reason.text}</span>
                              {reason.evidenceType && (
                                <span className="ml-1.5 inline-flex items-center text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                  Evidence: {reason.evidenceType}
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Wrench size={15} className="text-blue-600" />
                      <span className="text-xs font-semibold text-slate-900">Physical Damage Assessment</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        isDamageModelUnavailable
                          ? 'bg-slate-100 text-slate-700 border border-slate-300'
                          : damageScore >= 7.5
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : damageScore >= 4
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}>
                        {damageSeverity}
                      </span>
                      <span className="text-xs font-bold text-slate-900 font-mono">
                        {isDamageModelUnavailable ? 'Unassessed' : `${damageScore.toFixed(1)} / 10`}
                      </span>
                    </div>
                  </div>

                  <div className="w-full bg-slate-200 rounded h-1.5 overflow-hidden">
                    <div
                      className={`h-1.5 rounded ${
                        isDamageModelUnavailable ? 'bg-slate-400' : damageScore >= 7.5 ? 'bg-rose-600' : damageScore >= 4 ? 'bg-amber-500' : 'bg-blue-600'
                      }`}
                      style={{ width: `${isDamageModelUnavailable ? 0 : Math.min(100, damageScore * 10)}%` }}
                    />
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-0.5">What does this mean?</div>
                      <p className="text-slate-600 leading-relaxed text-xs">{damageWhatItMeans}</p>
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">Why did the system produce this result?</div>
                      <ul className="space-y-1.5">
                        {damageReasons.map((reason, idx) => (
                          <li key={idx} className="flex items-start gap-1.5 text-slate-700">
                            <span className="shrink-0 text-slate-400 mt-0.5">•</span>
                            <div className="flex-1 text-[11px] leading-snug">
                              <span>{reason.text}</span>
                              {reason.evidenceType && (
                                <span className="ml-1.5 inline-flex items-center text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                  Evidence: {reason.evidenceType}
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <FileText size={15} className="text-indigo-600" />
                      <span className="text-xs font-semibold text-slate-900">Narrative vs Visual Consistency</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        consistencyScore >= 7
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : consistencyScore >= 4
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}>
                        {consistencyRating}
                      </span>
                      <span className="text-xs font-bold text-slate-900 font-mono">
                        {consistencyScore.toFixed(1)} / 10
                      </span>
                    </div>
                  </div>

                  <div className="w-full bg-slate-200 rounded h-1.5 overflow-hidden">
                    <div
                      className={`h-1.5 rounded ${
                        consistencyScore >= 7 ? 'bg-emerald-600' : consistencyScore >= 4 ? 'bg-amber-500' : 'bg-rose-600'
                      }`}
                      style={{ width: `${Math.min(100, consistencyScore * 10)}%` }}
                    />
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-0.5">What does this mean?</div>
                      <p className="text-slate-600 leading-relaxed text-xs">{consistencyWhatItMeans}</p>
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">Why did the system produce this result?</div>
                      <ul className="space-y-1.5">
                        {consistencyReasons.map((reason, idx) => (
                          <li key={idx} className="flex items-start gap-1.5 text-slate-700">
                            {reason.isFlag ? (
                              <AlertCircle size={13} className="text-rose-500 shrink-0 mt-0.5" />
                            ) : (
                              <CheckCircle2 size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1 text-[11px] leading-snug">
                              <span>{reason.text}</span>
                              {reason.evidenceType && (
                                <span className="ml-1.5 inline-flex items-center text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                  Evidence: {reason.evidenceType}
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {damage.damagedParts && damage.damagedParts.length > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <div className="text-xs font-semibold text-slate-700 mb-1.5">Identified Damage Regions</div>
                    <div className="flex flex-wrap gap-1.5">
                      {damage.damagedParts.map((part, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded text-[11px]">
                          {part}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Human Assessment & Decision</h2>
              {getStatusBadge(claim.status)}
            </div>

            {humanAssessment.action && (
              <div className="p-3 bg-slate-50 rounded border border-slate-200 text-xs space-y-1.5">
                <span className="font-semibold text-slate-800 block text-[11px] uppercase tracking-wider">Latest Assessor Assessment</span>
                <div className="text-slate-600 flex justify-between">
                  <span>Assessor:</span>
                  <span className="font-medium text-slate-900">{humanAssessment.assessor?.name || 'Assessor'}</span>
                </div>
                <div className="text-slate-600 flex justify-between">
                  <span>Action:</span>
                  <span className="font-semibold text-slate-800">{humanAssessment.action}</span>
                </div>
                {humanAssessment.timestamp && (
                  <div className="text-slate-600 flex justify-between">
                    <span>Date:</span>
                    <span className="text-slate-700">{new Date(humanAssessment.timestamp).toLocaleString()}</span>
                  </div>
                )}
                {humanAssessment.reason && (
                  <p className="text-[11px] text-slate-600 mt-1 italic bg-white p-2 rounded border border-slate-200">
                    "{humanAssessment.reason}"
                  </p>
                )}
              </div>
            )}

            {decision && decision.outcome !== 'PENDING' && (
              <div className="p-3 bg-blue-50/50 rounded border border-blue-200 text-xs space-y-1.5">
                <span className="font-semibold text-blue-900 block text-[11px] uppercase tracking-wider">Recorded Adjudication Decision</span>
                <div className="text-slate-700 flex justify-between">
                  <span>Outcome:</span>
                  <span className="font-bold text-slate-900">{decision.outcome}</span>
                </div>
                <div className="text-slate-700 flex justify-between">
                  <span>Decision Maker:</span>
                  <span className="font-medium text-slate-900">{decision.decisionMaker?.name || 'Authorized Assessor'}</span>
                </div>
                {decision.timestamp && (
                  <div className="text-slate-700 flex justify-between">
                    <span>Decided At:</span>
                    <span className="text-slate-700">{new Date(decision.timestamp).toLocaleString()}</span>
                  </div>
                )}
                {decision.reason && (
                  <p className="text-[11px] text-slate-600 mt-1 italic bg-white p-2 rounded border border-slate-200">
                    "{decision.reason}"
                  </p>
                )}
              </div>
            )}

            {claim.status === CLAIM_STATUS.CLOSED ? (
              <div className="p-3 bg-slate-50 rounded border border-slate-200 text-xs text-slate-600 text-center">
                This claim is closed. Lifecycle is terminal and no further transitions can be applied.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Available Workflow Actions</div>

                {claim.status === CLAIM_STATUS.SUBMITTED && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleDecisionAction(CLAIM_STATUS.PROCESSING, 'Automated processing initiated')}
                      className="py-2 px-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded transition"
                    >
                      Begin Processing
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleDecisionAction(CLAIM_STATUS.CLOSED, 'Submission withdrawn or cancelled')}
                      className="py-2 px-3 bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-medium rounded transition"
                    >
                      Close Claim
                    </button>
                  </div>
                )}

                {claim.status === CLAIM_STATUS.PROCESSING && (
                  <div className="space-y-2">
                    {hasProcessingError ? (
                      <button
                        type="button"
                        disabled={retrying}
                        onClick={handleRetryProcessing}
                        className="w-full py-2 px-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-medium rounded transition"
                      >
                        {retrying ? 'Retrying...' : 'Retry Processing Pipeline'}
                      </button>
                    ) : (
                      <div className="p-2.5 bg-slate-50 rounded border border-slate-200 text-center text-xs text-slate-500">
                        Analysis currently running. Actions will enable once AI assessment completes.
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleDecisionAction(CLAIM_STATUS.CLOSED, 'Processing abandoned and claim closed')}
                      className="w-full py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded transition border border-slate-200"
                    >
                      Cancel & Close Claim
                    </button>
                  </div>
                )}

                {claim.status === CLAIM_STATUS.AI_ASSESSED && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleDecisionAction(CLAIM_STATUS.PENDING_REVIEW, 'Moved to assessor inspection queue')}
                      className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-medium rounded transition"
                    >
                      Queue for Assessor Review
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleDecisionAction(CLAIM_STATUS.UNDER_REVIEW, 'Assessor took immediate ownership of claim')}
                      className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded transition"
                    >
                      Review Immediately (Under Review)
                    </button>
                  </div>
                )}

                {['PENDING_REVIEW', 'NEEDS_INFORMATION'].includes(claim.status) && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleDecisionAction(CLAIM_STATUS.UNDER_REVIEW, 'Assessor opened claim for detailed investigation')}
                    className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded transition"
                  >
                    Start Investigation (Move to Under Review)
                  </button>
                )}

                {claim.status === CLAIM_STATUS.UNDER_REVIEW && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handleDecisionAction(CLAIM_STATUS.APPROVED, 'Claim approved following evidence review')}
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-medium rounded transition"
                      >
                        Approve Claim
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => setShowReqInfoModal(true)}
                        className="px-3 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-medium rounded transition"
                      >
                        Request Information
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handleDecisionAction(CLAIM_STATUS.REJECTED, 'Claim rejected based on evidence inconsistencies')}
                        className="px-3 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-medium rounded transition"
                      >
                        Reject Claim
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => setShowOverrideDialog(!showOverrideDialog)}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-xs font-medium rounded transition"
                      >
                        Manual Override
                      </button>
                    </div>
                  </div>
                )}

                {['APPROVED', 'REJECTED'].includes(claim.status) && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleDecisionAction(CLAIM_STATUS.CLOSED, 'Settlement and adjudication completed. Claim closed.')}
                    className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-xs font-medium rounded transition"
                  >
                    Archive & Close Claim
                  </button>
                )}
              </div>
            )}

            {showOverrideDialog && (
              <form onSubmit={handleOverrideSubmit} className="pt-3 border-t border-slate-100 space-y-3">
                <div className="text-xs font-semibold text-slate-800">Record Assessor Override</div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">New Determination</label>
                  <select
                    value={overrideData.newRecommendation}
                    onChange={(e) => setOverrideData({ ...overrideData, newRecommendation: e.target.value })}
                    className="w-full text-xs bg-white border border-slate-200 rounded px-2 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  >
                    <option value="">Select determination...</option>
                    <option value="APPROVE">APPROVE (Fast-track settlement)</option>
                    <option value="MANUAL_REVIEW">MANUAL_REVIEW (Further inspection)</option>
                    <option value="REJECT">REJECT (Denial based on evidence)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">Mandatory Justification Rationale</label>
                  <textarea
                    rows={3}
                    value={overrideData.reason}
                    onChange={(e) => setOverrideData({ ...overrideData, reason: e.target.value })}
                    placeholder="Provide specific justification for audit compliance..."
                    className="w-full text-xs bg-white border border-slate-200 rounded p-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium py-1.5 rounded transition"
                  >
                    Save Override
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowOverrideDialog(false)}
                    className="px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs py-1.5 rounded border border-slate-200"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {showReqInfoModal && (
              <form onSubmit={handleRequestInfoSubmit} className="pt-3 border-t border-slate-100 space-y-3">
                <div className="text-xs font-semibold text-slate-800">Request Supplemental Information</div>
                <textarea
                  rows={3}
                  value={reqInfoNotes}
                  onChange={(e) => setReqInfoNotes(e.target.value)}
                  placeholder="Specify required documents, photos, or police reports..."
                  className="w-full text-xs bg-white border border-slate-200 rounded p-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium py-1.5 rounded transition"
                  >
                    Send Request
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowReqInfoModal(false)}
                    className="px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs py-1.5 rounded border border-slate-200"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded overflow-hidden">
            <button
              type="button"
              onClick={() => setShowTechnicalAnalysis(!showTechnicalAnalysis)}
              className="w-full p-4 text-left flex items-center justify-between text-xs font-semibold text-slate-800 hover:bg-slate-50 transition"
            >
              <div className="flex items-center gap-2">
                <Database size={15} className="text-slate-500" />
                <div>
                  <span>Advanced Technical & Model Evidence Details</span>
                  <span className="block text-[11px] font-normal text-slate-400">
                    YOLO detections, VLM reasoning, perceptual hashes, and model execution diagnostics
                  </span>
                </div>
              </div>
              {showTechnicalAnalysis ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showTechnicalAnalysis && (
              <div className="p-4 border-t border-slate-100 text-xs space-y-3 bg-slate-50">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-white rounded border border-slate-200 space-y-2">
                    <div className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                      <Camera size={13} className="text-slate-500" /> YOLO Vehicle Localization
                    </div>
                    <div className="space-y-1 text-slate-600 text-[11px]">
                      <div className="flex justify-between">
                        <span>Vehicle Detections:</span>
                        <span className="font-mono text-slate-900">{yoloAggregate.totalKeyframeDetections || (damage.damagedParts?.length || 1)} detected</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Localization Confidence:</span>
                        <span className="font-mono text-slate-900">
                          {yoloAggregate.meanConfidence ? `${(yoloAggregate.meanConfidence * 100).toFixed(1)}%` : 'Validated'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Vehicle Frame Coverage:</span>
                        <span className="font-mono text-slate-900">
                          {yoloAggregate.aggregateDamageAreaRatio !== undefined
                            ? `${(yoloAggregate.aggregateDamageAreaRatio * 100).toFixed(1)}%`
                            : (yoloAggregate.areaCoverageRatio !== undefined ? `${(yoloAggregate.areaCoverageRatio * 100).toFixed(1)}%` : 'Verified')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Primary Vehicle Status:</span>
                        <span className="font-mono text-emerald-700 font-medium">Localized in frame</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded border border-slate-200 space-y-2">
                    <div className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles size={13} className="text-slate-500" /> Vision-Language Model (VLM)
                    </div>
                    <div className="space-y-1 text-slate-600 text-[11px]">
                      <div className="flex justify-between">
                        <span>Model Architecture:</span>
                        <span className="font-mono text-slate-900">Vision-Language Transformer</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Model Severity Rating:</span>
                        <span className="font-mono text-slate-900">{damage.severity || 'Moderate'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Cross-Modal Consistency:</span>
                        <span className="font-mono text-slate-900">{consistency.isConsistent !== false ? 'Passed' : 'Flagged for Review'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Evaluated Media:</span>
                        <span className="font-mono text-slate-900">{isVideoClaim ? `${keyframeInfo.ranking?.length || 1} Keyframes` : 'Primary Photo'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded border border-slate-200 space-y-2">
                    <div className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck size={13} className="text-slate-500" /> Forensics & Duplicate Hashes
                    </div>
                    <div className="space-y-1 text-slate-600 text-[11px]">
                      <div className="flex justify-between">
                        <span>Hash Vector Similarity:</span>
                        <span className="font-mono text-slate-900">
                          {videoDup.similarityScore ? `${(videoDup.similarityScore * 100).toFixed(1)}%` : '0.0%'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Cross-Policy Duplication:</span>
                        <span className="font-mono text-slate-900">
                          {videoDup.crossPolicyReuse ? 'Flagged across accounts' : 'Unique'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Mirrored Footage Check:</span>
                        <span className="font-mono text-slate-900">
                          {videoDup.isMirrored ? 'Mirrored duplicate' : 'Original orientation'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Editing Software Trace:</span>
                        <span className="font-mono text-slate-900">
                          {metaFraud.editingSoftwareDetected ? (metaFraud.editingTools?.join(', ') || 'Detected') : 'None detected'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded border border-slate-200 space-y-2">
                    <div className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                      <Layers size={13} className="text-slate-500" /> Pipeline Execution Context
                    </div>
                    <div className="space-y-1 text-slate-600 text-[11px]">
                      <div className="flex justify-between">
                        <span>Inference Job ID:</span>
                        <span className="font-mono text-slate-900 truncate max-w-[130px]">{claim.jobId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Pipeline State:</span>
                        <span className="font-mono text-slate-900">{claim.status}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Evidence Medium:</span>
                        <span className="font-mono text-slate-900">{isVideoClaim ? 'Video Walk-Around' : 'Single Photo'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Reprocessing Count:</span>
                        <span className="font-mono text-slate-900">{claim.processingError?.retryCount || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClaimDetail;
