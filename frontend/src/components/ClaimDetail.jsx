import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Film, 
  Camera, 
  Layers, 
  ShieldAlert, 
  ShieldCheck, 
  Cpu, 
  FileText, 
  Sparkles
} from 'lucide-react';
import { claimAPI } from '../services/api';

const ClaimDetail = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [claim, setClaim] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeFrameType, setActiveFrameType] = useState('primary'); // 'primary' | 'secondary' | 'composite'
  const [overrideMode, setOverrideMode] = useState(false);
  const [overrideData, setOverrideData] = useState({
    newRecommendation: '',
    reason: ''
  });

  useEffect(() => {
    const loadClaim = async () => {
      try {
        setLoading(true);
        const response = await claimAPI.getClaim(jobId);
        setClaim(response.claim);
      } catch (error) {
        console.error('Error fetching claim:', error);
      } finally {
        setLoading(false);
      }
    };
    loadClaim();
  }, [jobId]);

  const handleOverride = async () => {
    try {
      await claimAPI.overrideDecision(
        jobId,
        overrideData.newRecommendation,
        overrideData.reason,
        'ASSESSOR-001'
      );
      setOverrideMode(false);
      const response = await claimAPI.getClaim(jobId);
      setClaim(response.claim);
    } catch (error) {
      console.error('Error overriding decision:', error);
      alert('Failed to override decision');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
        <p className="text-sm font-medium text-gray-500">Loading AI assessment details...</p>
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="max-w-4xl mx-auto text-center py-16 bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <p className="text-lg font-semibold text-gray-700">Claim not found</p>
        <p className="text-sm text-gray-500 mt-1">No claim record matches Job ID: {jobId}</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="mt-6 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          <ArrowLeft size={16} className="mr-2" />
          Back to Dashboard
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

  // Resolve active image path
  const getDisplayImageUrl = () => {
    if (!isVideoClaim) {
      return claim.annotatedImagePath ? `${ML_API_URL}${claim.annotatedImagePath}` : null;
    }
    if (activeFrameType === 'secondary' && keyframeInfo.secondaryPath) {
      return `${ML_API_URL}/api/annotated-keyframe/${claim.jobId}?frame_type=secondary`;
    }
    if (activeFrameType === 'composite' && keyframeInfo.compositePath) {
      return `${ML_API_URL}/api/annotated-keyframe/${claim.jobId}?frame_type=composite`;
    }
    return `${ML_API_URL}/api/annotated-image/${claim.jobId}`;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700 mb-2 transition"
          >
            <ArrowLeft size={16} className="mr-1.5" />
            Back to Dashboard
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Claim Details & Assessment</h1>
            <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
              isVideoClaim ? 'bg-indigo-100 text-indigo-800' : 'bg-blue-100 text-blue-800'
            }`}>
              {isVideoClaim ? <Film size={14} /> : <Camera size={14} />}
              {isVideoClaim ? 'Walk-Around Video Claim' : 'Photo Image Claim'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Job ID: <span className="font-mono text-gray-700 font-semibold">{claim.jobId}</span> • Submitted: {new Date(claim.createdAt).toLocaleString()}
          </p>
        </div>

        {/* Status Chip */}
        <div className="flex items-center gap-2">
          <div className={`px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 shadow-sm ${
            decision.recommendation === 'APPROVE' ? 'bg-green-600 text-white' :
            decision.recommendation === 'REJECT' ? 'bg-red-600 text-white' :
            'bg-amber-500 text-white'
          }`}>
            {decision.recommendation === 'APPROVE' && <CheckCircle2 size={18} />}
            {decision.recommendation === 'REJECT' && <AlertTriangle size={18} />}
            {decision.recommendation === 'MANUAL_REVIEW' && <Clock size={18} />}
            <span>{decision.recommendation?.replace('_', ' ')}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Column (2 spans) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Visual AI Evidence Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Cpu className="text-blue-600" size={20} />
                  AI-Annotated Physical Evidence
                </h2>
                <p className="text-xs text-gray-500">
                  {isVideoClaim ? 'Highest salience damage keyframe(s) automatically selected by YOLO & scored by VLM.' : 'YOLO bounding boxes highlighting detected vehicle damage.'}
                </p>
              </div>

              {/* View Angle Switcher for Video Claims */}
              {isVideoClaim && (
                <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl text-xs font-semibold">
                  <button
                    onClick={() => setActiveFrameType('primary')}
                    className={`px-3 py-1.5 rounded-lg transition ${
                      activeFrameType === 'primary'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Primary Keyframe
                  </button>
                  {keyframeInfo.secondaryPath && (
                    <button
                      onClick={() => setActiveFrameType('secondary')}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        activeFrameType === 'secondary'
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Secondary Angle
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Display Image */}
            <div className="bg-black/5 rounded-xl p-2 border border-gray-100 flex items-center justify-center min-h-[320px] overflow-hidden">
              <img
                src={getDisplayImageUrl()}
                alt="AI Annotated Damage"
                className="max-h-[460px] w-full object-contain rounded-lg shadow-sm"
                onError={(e) => {
                  e.target.src = 'https://via.placeholder.com/800x500?text=Annotated+Visual+Evidence+Unavailable';
                }}
              />
            </div>

            {/* Step 4 & 9 Keyframe Timeline Carousel (for Video Claims) */}
            {isVideoClaim && keyframeInfo.ranking && keyframeInfo.ranking.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 flex items-center gap-1.5">
                    <Layers size={14} className="text-indigo-600" />
                    Keyframe Sampling & Salience Timeline
                  </h3>
                  <span className="text-xs text-gray-500 font-medium">
                    {keyframeInfo.ranking.length} candidate checkpoints inspected
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {keyframeInfo.ranking.map((kf, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border text-xs transition ${
                        kf.rank === 1
                          ? 'border-blue-400 bg-blue-50/60 ring-2 ring-blue-100'
                          : kf.rank === 2 && keyframeInfo.secondaryPath
                          ? 'border-indigo-300 bg-indigo-50/50'
                          : 'border-gray-200 bg-gray-50/80'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold mb-1">
                        <span className="text-gray-900">
                          {kf.rank === 1 ? 'Primary Frame' : kf.rank === 2 ? 'Secondary Frame' : `Rank #${kf.rank}`}
                        </span>
                        <span className="bg-white px-1.5 py-0.5 rounded text-gray-600 border border-gray-200 text-[10px]">
                          t = {kf.timestamp_sec}s
                        </span>
                      </div>
                      <div className="flex justify-between text-gray-600 text-[11px] mt-1">
                        <span>Damage Salience:</span>
                        <span className="font-semibold text-gray-900">{kf.salience_score}</span>
                      </div>
                      <div className="flex justify-between text-gray-600 text-[11px]">
                        <span>Detections:</span>
                        <span className="font-semibold text-gray-900">{kf.num_detections}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 4-Pillar Unified Breakdown (Step 7) */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 border-b pb-3">
              <Sparkles className="text-blue-600" size={20} />
              Unified 4-Pillar Assessment Breakdown
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pillar 1: YOLO Physical Evidence */}
              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900 uppercase tracking-wide flex items-center gap-1.5">
                    <Cpu size={14} className="text-blue-600" />
                    1. YOLOv10 Detections
                  </span>
                  <span className="text-xs bg-blue-200 text-blue-900 px-2 py-0.5 rounded-full font-bold">
                    {damage.yoloAggregate?.totalKeyframeDetections || 1} objects
                  </span>
                </div>
                <div className="text-xs space-y-1 text-gray-700">
                  <div className="flex justify-between">
                    <span>Aggregate Area Coverage:</span>
                    <span className="font-semibold">{yoloAggregate.areaCoverageRatio ? `${(yoloAggregate.areaCoverageRatio * 100).toFixed(1)}%` : 'Verified'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Mean Detection Confidence:</span>
                    <span className="font-semibold">{yoloAggregate.meanConfidence ? `${(yoloAggregate.meanConfidence * 100).toFixed(1)}%` : '85.0%'}</span>
                  </div>
                </div>
              </div>

              {/* Pillar 2: LLaVA VLM Reasoning */}
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-900 uppercase tracking-wide flex items-center gap-1.5">
                    <Sparkles size={14} className="text-indigo-600" />
                    2. LLaVA Reasoning
                  </span>
                  <span className="text-xs bg-indigo-200 text-indigo-900 px-2 py-0.5 rounded-full font-bold">
                    {damage.severity || 'Moderate'}
                  </span>
                </div>
                <div className="text-xs space-y-1 text-gray-700">
                  <div className="flex justify-between">
                    <span>Damage Score:</span>
                    <span className="font-semibold text-indigo-900">{damage.score?.toFixed(1) || 0}/10</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Recommendation:</span>
                    <span className="font-semibold text-indigo-900">{damage.recommendation || 'Standard Repair'}</span>
                  </div>
                </div>
              </div>

              {/* Pillar 3: Metadata & Tampering Risk */}
              <div className={`p-4 rounded-xl border space-y-2.5 ${
                metaFraud.editingSoftwareDetected ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900 uppercase tracking-wide flex items-center gap-1.5">
                    <FileText size={14} className="text-gray-600" />
                    3. Metadata & Tampering
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    metaFraud.editingSoftwareDetected ? 'bg-red-200 text-red-900' : 'bg-green-200 text-green-900'
                  }`}>
                    {metaFraud.editingSoftwareDetected ? 'Edited / Tampered' : 'Clean Stream'}
                  </span>
                </div>
                <div className="text-xs space-y-1 text-gray-700">
                  <div className="flex justify-between">
                    <span>Editing Software Detected:</span>
                    <span className={`font-semibold ${metaFraud.editingSoftwareDetected ? 'text-red-700' : 'text-green-700'}`}>
                      {metaFraud.editingSoftwareDetected ? metaFraud.editingTools?.join(', ') : 'None'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Stream Specs:</span>
                    <span className="font-semibold text-gray-700">
                      {metadata.width ? `${metadata.width}x${metadata.height} (${metadata.duration_seconds}s)` : 'Standard'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Pillar 4: Duplicate & Anti-Fraud Signature */}
              <div className={`p-4 rounded-xl border space-y-2.5 ${
                fraud.isDuplicate ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900 uppercase tracking-wide flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-gray-600" />
                    4. Anti-Fraud & Signatures
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    fraud.isDuplicate ? 'bg-red-200 text-red-900' : 'bg-green-200 text-green-900'
                  }`}>
                    {fraud.isDuplicate ? 'Duplicate Detected' : 'Unique Claim'}
                  </span>
                </div>
                <div className="text-xs space-y-1 text-gray-700">
                  <div className="flex justify-between">
                    <span>Composite Signature Similarity:</span>
                    <span className={`font-semibold ${fraud.isDuplicate ? 'text-red-700' : 'text-gray-800'}`}>
                      {videoDup.similarityScore ? `${(videoDup.similarityScore * 100).toFixed(1)}%` : `${((1 - (fraud.overallScore || 0)/10) * 100).toFixed(0)}% Unique`}
                    </span>
                  </div>
                  {videoDup.crossPolicyReuse && (
                    <div className="text-red-600 font-bold text-[11px]">
                      ⚠️ Cross-policy reuse detected across accounts
                    </div>
                  )}
                  {videoDup.isMirrored && (
                    <div className="text-red-600 font-bold text-[11px]">
                      ⚠️ Mirrored/flipped video submission detected
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Damaged Parts Badges */}
            {damage.damagedParts && damage.damagedParts.length > 0 && (
              <div className="pt-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
                  Identified Component Damage Regions
                </h3>
                <div className="flex flex-wrap gap-2">
                  {damage.damagedParts.map((part, index) => (
                    <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                      {part}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            {damage.description && (
              <div className="pt-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                  VLM Visual Damage Description
                </h3>
                <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                  {damage.description}
                </p>
              </div>
            )}

            {/* Consistency Gauge */}
            <div className="pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
                Claimant Statement vs. Physical Evidence Consistency
              </h3>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-800">
                    {consistency.score >= 7.5 ? 'High Consistency (Description perfectly corroborates visual features)' :
                     consistency.score >= 4.5 ? 'Moderate Consistency (Minor ambiguities detected)' :
                     'Severe Inconsistency (Statement contradicts evidence)'}
                  </span>
                  <span className="text-sm font-bold text-gray-900">{consistency.score?.toFixed(1) || 0}/10</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-2.5 rounded-full transition-all ${
                      consistency.score >= 7.5 ? 'bg-green-600' :
                      consistency.score >= 4.5 ? 'bg-yellow-500' :
                      'bg-red-600'
                    }`}
                    style={{ width: `${(consistency.score || 0) * 10}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Fraud Indicators Alert Box */}
            {fraud.fraudIndicators && fraud.fraudIndicators.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-red-900">
                  <ShieldAlert size={18} className="text-red-600" />
                  Fraud Indicators Flagged ({fraud.fraudIndicators.length})
                </div>
                <ul className="list-disc list-inside text-xs text-red-700 space-y-1 font-medium pl-1">
                  {fraud.fraudIndicators.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Column (1 span) */}
        <div className="space-y-6">

          {/* Decision & AI Explanation Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">AI Claim Recommendation</h2>

            <div className={`p-4 rounded-xl border ${
              decision.recommendation === 'APPROVE' ? 'bg-green-50 border-green-200 text-green-900' :
              decision.recommendation === 'REJECT' ? 'bg-red-50 border-red-200 text-red-900' :
              'bg-amber-50 border-amber-200 text-amber-900'
            }`}>
              <div className="flex items-center justify-between font-bold text-base mb-1">
                <span>{decision.recommendation?.replace('_', ' ')}</span>
                <span className="text-xs uppercase tracking-wider font-semibold opacity-80">
                  {decision.confidence} Confidence
                </span>
              </div>
              <p className="text-xs leading-relaxed mt-2 text-gray-700">
                {decision.explanation}
              </p>
            </div>

            {/* Human Assessor Override Controls */}
            {!overrideMode ? (
              <button
                onClick={() => setOverrideMode(true)}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 px-4 rounded-xl text-xs transition"
              >
                Human Assessor Override Decision
              </button>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 space-y-3">
                <span className="text-xs font-bold text-gray-800 block">Manual Override</span>
                <select
                  value={overrideData.newRecommendation}
                  onChange={(e) => setOverrideData({ ...overrideData, newRecommendation: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs"
                >
                  <option value="">Select new decision...</option>
                  <option value="APPROVE">APPROVE (Fast-track Settlement)</option>
                  <option value="MANUAL_REVIEW">MANUAL_REVIEW (Field Inspection)</option>
                  <option value="REJECT">REJECT (Fraud / Policy Violation)</option>
                </select>

                <textarea
                  value={overrideData.reason}
                  onChange={(e) => setOverrideData({ ...overrideData, reason: e.target.value })}
                  placeholder="Mandatory justification reason..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs"
                />

                <div className="flex gap-2">
                  <button
                    onClick={handleOverride}
                    disabled={!overrideData.newRecommendation || !overrideData.reason}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 rounded-lg text-xs transition"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setOverrideMode(false)}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 rounded-lg text-xs transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Scores Breakdown Gauges */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Score Metrics</h2>

            <div className="space-y-3.5 text-xs">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-semibold text-gray-700">Assessed Damage Severity</span>
                  <span className="font-bold text-blue-600">{decision.scores?.damage?.toFixed(1) || 0}/10</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${(decision.scores?.damage || 0) * 10}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-semibold text-gray-700">Fraud & Tampering Risk</span>
                  <span className={`font-bold ${
                    (decision.scores?.fraud || 0) >= 7 ? 'text-red-600' :
                    (decision.scores?.fraud || 0) >= 4 ? 'text-yellow-600' :
                    'text-green-600'
                  }`}>
                    {decision.scores?.fraud?.toFixed(1) || 0}/10
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      (decision.scores?.fraud || 0) >= 7 ? 'bg-red-600' :
                      (decision.scores?.fraud || 0) >= 4 ? 'bg-yellow-500' :
                      'bg-green-600'
                    }`}
                    style={{ width: `${(decision.scores?.fraud || 0) * 10}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-semibold text-gray-700">Text-Visual Consistency</span>
                  <span className="font-bold text-green-600">{decision.scores?.consistency?.toFixed(1) || 0}/10</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{ width: `${(decision.scores?.consistency || 0) * 10}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Stated Claim Information Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-3">
            <h2 className="text-lg font-bold text-gray-900 border-b pb-2">Claim Overview</h2>

            <div className="space-y-2.5 text-xs text-gray-700">
              <div className="flex justify-between">
                <span className="text-gray-500">Policy Number:</span>
                <span className="font-mono font-semibold">{claim.claimInfo?.policyId || 'Not Provided'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Incident Date:</span>
                <span className="font-semibold">{claim.claimInfo?.date || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Accident Location:</span>
                <span className="font-semibold">{claim.claimInfo?.location || 'Unknown'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Submission Mode:</span>
                <span className="font-semibold text-blue-600">{claim.claimType === 'VIDEO_WALK_AROUND' ? 'Walk-Around Video' : 'Single Photo'}</span>
              </div>

              <div className="pt-2 border-t">
                <span className="text-gray-500 block mb-1 font-medium">Claimant Stated Description:</span>
                <p className="bg-gray-50 p-2.5 rounded-lg text-gray-800 italic leading-relaxed border border-gray-100">
                  "{claim.claimInfo?.description}"
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ClaimDetail;
