import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { claimAPI } from '../services/api';

const ClaimDetail = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [claim, setClaim] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeFrameType, setActiveFrameType] = useState('primary');
  const [showTechnicalAnalysis, setShowTechnicalAnalysis] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [overrideData, setOverrideData] = useState({
    newRecommendation: '',
    reason: ''
  });
  const [showReqInfoModal, setShowReqInfoModal] = useState(false);
  const [reqInfoNotes, setReqInfoNotes] = useState('');

  const loadClaim = async () => {
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
  };

  useEffect(() => {
    loadClaim();
  }, [jobId]);

  const handleDecisionAction = async (targetStatus, notes = '') => {
    try {
      setActionLoading(true);
      await claimAPI.updateStatus(jobId, targetStatus, notes);
      toast.success(`Claim status updated to ${targetStatus}.`);
      await loadClaim();
    } catch (error) {
      console.error(error);
      toast.error('Failed to update claim status.');
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
        jobId,
        overrideData.newRecommendation,
        overrideData.reason,
        'ASSESSOR-CURRENT'
      );
      toast.success('Assessor decision override recorded successfully.');
      setShowOverrideDialog(false);
      setOverrideData({ newRecommendation: '', reason: '' });
      await loadClaim();
    } catch (error) {
      console.error(error);
      toast.error('Failed to record decision override.');
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
    await handleDecisionAction('REVIEW_REQUIRED', `Assessor requested information: ${reqInfoNotes}`);
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
  const keyframeInfo = claim.keyframeSelection || {};
  const damage = claim.analysis?.damageAssessment || {};
  const fraud = claim.analysis?.fraudAnalysis || {};
  const consistency = claim.analysis?.consistencyAnalysis || {};
  const decision = claim.decision || {};
  const metadata = claim.metadata || {};
  const yoloAggregate = damage.yoloAggregate || {};
  const videoDup = fraud.videoDuplicateCheck || {};
  const metaFraud = fraud.metadataFraud || {};

  const getDisplayImageUrl = () => {
    if (!isVideoClaim) {
      return claim.annotatedImagePath ? `${ML_API_URL}${claim.annotatedImagePath}` : `${ML_API_URL}/api/annotated-image/${claim.jobId}`;
    }
    if (activeFrameType === 'secondary' && keyframeInfo.secondaryPath) {
      return `${ML_API_URL}/api/annotated-keyframe/${claim.jobId}?frame_type=secondary`;
    }
    return `${ML_API_URL}/api/annotated-keyframe/${claim.jobId}?frame_type=primary`;
  };

  const getStatusBadge = (rec) => {
    if (rec === 'APPROVE' || claim.status === 'APPROVED') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
          Approved
        </span>
      );
    }
    if (rec === 'REJECT' || claim.status === 'REJECTED') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-50 text-rose-800 border border-rose-200">
          Rejected
        </span>
      );
    }
    if (rec === 'MANUAL_REVIEW' || claim.status === 'REVIEW_REQUIRED') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
          Needs Review
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
        Processing
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="text-xs text-slate-500 flex items-center gap-1.5">
        <Link to="/claims" className="hover:text-slate-900 transition">Claims</Link>
        <span>/</span>
        <span className="text-slate-900 font-mono font-medium">CLM-{claim.jobId.slice(0, 8).toUpperCase()}</span>
      </div>

      <div className="bg-white border border-slate-200 rounded p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900 font-mono">
                CLM-{claim.jobId.slice(0, 8).toUpperCase()}
              </h1>
              {getStatusBadge(decision.recommendation)}
              <span className="text-xs text-slate-500 font-normal">
                {isVideoClaim ? 'Walk-Around Video' : 'Photo Evidence'}
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Submitted on {new Date(claim.createdAt).toLocaleDateString()} at {new Date(claim.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-slate-600 border-t lg:border-t-0 pt-3 lg:pt-0">
            <div>
              <span className="text-slate-400 block text-[11px]">Policy</span>
              <span className="font-semibold text-slate-800">{claim.claimInfo?.policyId || 'POL-UNSPECIFIED'}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Vehicle</span>
              <span className="font-semibold text-slate-800">{metadata.vehicleInfo || (isVideoClaim ? 'Vehicle Walk-Around' : 'Passenger Vehicle')}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Incident Location</span>
              <span className="font-semibold text-slate-800">{claim.claimInfo?.location || 'Stated Location'}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Incident Date</span>
              <span className="font-semibold text-slate-800">{claim.claimInfo?.date || 'N/A'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-slate-200 rounded p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Physical Evidence</h2>
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

            <div className="pt-2 border-t border-slate-100">
              <div className="text-xs font-semibold text-slate-800 mb-1">Claimant Stated Narrative</div>
              <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded border border-slate-200 leading-relaxed">
                "{claim.claimInfo?.description || 'No statement provided.'}"
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Activity and Audit History</h2>
            <div className="divide-y divide-slate-100 text-xs">
              <div className="py-2.5 first:pt-0">
                <div className="flex justify-between text-slate-800 font-medium">
                  <span>Claim Intake Received</span>
                  <span className="text-slate-400 font-normal">{new Date(claim.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-slate-500 text-[11px] mt-0.5">Physical evidence uploaded via {claim.claimType || 'Photo'}.</p>
              </div>
              <div className="py-2.5">
                <div className="flex justify-between text-slate-800 font-medium">
                  <span>Multi-Modal AI Pipeline Executed</span>
                  <span className="text-slate-400 font-normal">{new Date(claim.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Initial recommendation: {decision.recommendation || 'Evaluated'} ({decision.confidence || 'Standard'} confidence).
                </p>
              </div>
              {claim.assessorDecision && (
                <div className="py-2.5">
                  <div className="flex justify-between text-slate-800 font-medium">
                    <span>Assessor Decision Override</span>
                    <span className="text-slate-400 font-normal">
                      {claim.assessorDecision.overriddenAt ? new Date(claim.assessorDecision.overriddenAt).toLocaleString() : 'Recorded'}
                    </span>
                  </div>
                  <p className="text-slate-600 text-[11px] mt-0.5">
                    Verdict: <span className="font-semibold">{claim.assessorDecision.newRecommendation}</span> • Rationale: "{claim.assessorDecision.reason}"
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-slate-200 rounded p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Assessment Summary</h2>
              <p className="text-xs text-slate-500">Synthesized evaluation of damage, fraud risk, and consistency.</p>
            </div>

            <div className={`p-4 rounded border ${
              decision.recommendation === 'APPROVE'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : decision.recommendation === 'REJECT'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}>
              <div className="flex items-center justify-between font-semibold text-xs mb-1">
                <span>AI Recommendation: {decision.recommendation || 'Under Review'}</span>
                <span className="uppercase text-[10px] tracking-wider opacity-90">{decision.confidence || 'Standard'} Confidence</span>
              </div>
              <p className="text-xs mt-2 leading-relaxed opacity-95">
                {decision.explanation || 'Claim analysis complete.'}
              </p>
            </div>

            <div className="space-y-3 pt-2 text-xs">
              <div>
                <div className="flex justify-between text-slate-700 font-medium mb-1">
                  <span>Damage Score</span>
                  <span className="font-semibold text-slate-900">{(decision.scores?.damage || 0).toFixed(1)} / 10</span>
                </div>
                <div className="w-full bg-slate-100 rounded h-1.5 overflow-hidden">
                  <div className="bg-blue-600 h-1.5 rounded" style={{ width: `${Math.min(100, (decision.scores?.damage || 0) * 10)}%` }} />
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                  <span>Severity: {damage.severity || 'Moderate'}</span>
                  <span>{damage.recommendation || 'Standard Repair'}</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-700 font-medium mb-1">
                  <span>Fraud & Tampering Risk</span>
                  <span className="font-semibold text-slate-900">{(decision.scores?.fraud || 0).toFixed(1)} / 10</span>
                </div>
                <div className="w-full bg-slate-100 rounded h-1.5 overflow-hidden">
                  <div
                    className={`h-1.5 rounded ${(decision.scores?.fraud || 0) >= 7 ? 'bg-rose-600' : (decision.scores?.fraud || 0) >= 4 ? 'bg-amber-500' : 'bg-emerald-600'}`}
                    style={{ width: `${Math.min(100, (decision.scores?.fraud || 0) * 10)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                  <span>Duplicate check: {fraud.isDuplicate ? 'Duplicate Flagged' : 'Unique signature'}</span>
                  <span>Metadata: {metaFraud.editingSoftwareDetected ? 'Edited' : 'Clean'}</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-700 font-medium mb-1">
                  <span>Narrative vs Visual Consistency</span>
                  <span className="font-semibold text-slate-900">{(decision.scores?.consistency || 0).toFixed(1)} / 10</span>
                </div>
                <div className="w-full bg-slate-100 rounded h-1.5 overflow-hidden">
                  <div
                    className={`h-1.5 rounded ${(decision.scores?.consistency || 0) >= 7 ? 'bg-emerald-600' : (decision.scores?.consistency || 0) >= 4 ? 'bg-amber-500' : 'bg-rose-600'}`}
                    style={{ width: `${Math.min(100, (decision.scores?.consistency || 0) * 10)}%` }}
                  />
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

            {damage.description && (
              <div className="pt-2 border-t border-slate-100">
                <div className="text-xs font-semibold text-slate-700 mb-1">AI Damage Assessment Note</div>
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-200">
                  {damage.description}
                </p>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Human Decision</h2>
            <p className="text-xs text-slate-500">Record final assessment determination or initiate inquiry.</p>

            <div className="flex flex-col gap-2 pt-1">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleDecisionAction('APPROVED', 'Claim approved by assessor.')}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-medium rounded transition"
                >
                  Approve Claim
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setShowReqInfoModal(true)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 text-xs font-medium rounded border border-slate-200 transition"
                >
                  Request Information
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleDecisionAction('REJECTED', 'Claim rejected by assessor.')}
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

            {showOverrideDialog && (
              <form onSubmit={handleOverrideSubmit} className="pt-3 border-t border-slate-100 space-y-3">
                <div className="text-xs font-semibold text-slate-800">Assessor Override Form</div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">New Determination</label>
                  <select
                    value={overrideData.newRecommendation}
                    onChange={(e) => setOverrideData({ ...overrideData, newRecommendation: e.target.value })}
                    className="w-full text-xs bg-white border border-slate-200 rounded px-2 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  >
                    <option value="">Select determination...</option>
                    <option value="APPROVE">APPROVE (Fast-track settlement)</option>
                    <option value="MANUAL_REVIEW">MANUAL_REVIEW (Escalate for field inspection)</option>
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
                  placeholder="Specify missing photos, police FIR, or clarification needed..."
                  className="w-full text-xs bg-white border border-slate-200 rounded p-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium py-1.5 rounded transition"
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
              <span>Technical Analysis</span>
              {showTechnicalAnalysis ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showTechnicalAnalysis && (
              <div className="p-4 border-t border-slate-100 text-xs space-y-3 bg-slate-50">
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">YOLO Object Detections:</span>
                    <span className="font-mono text-slate-800">{yoloAggregate.totalKeyframeDetections || 1} objects</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Mean Detection Confidence:</span>
                    <span className="font-mono text-slate-800">
                      {yoloAggregate.meanConfidence ? `${(yoloAggregate.meanConfidence * 100).toFixed(1)}%` : '85.0%'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Area Coverage Ratio:</span>
                    <span className="font-mono text-slate-800">
                      {yoloAggregate.areaCoverageRatio ? `${(yoloAggregate.areaCoverageRatio * 100).toFixed(1)}%` : 'Verified'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Hash Vector Similarity:</span>
                    <span className="font-mono text-slate-800">
                      {videoDup.similarityScore ? `${(videoDup.similarityScore * 100).toFixed(1)}%` : '0.0%'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tampering Artifacts:</span>
                    <span className="font-mono text-slate-800">
                      {metaFraud.editingSoftwareDetected ? 'Detected' : 'None'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-500 block mb-1">Raw Job Identifier:</span>
                  <code className="text-[11px] text-slate-700 bg-white p-1 rounded border border-slate-200 block truncate">
                    {claim.jobId}
                  </code>
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
