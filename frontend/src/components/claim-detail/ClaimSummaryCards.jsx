import React from 'react';
import { ShieldAlert, AlertTriangle, FileCheck, Sparkles } from 'lucide-react';

const ClaimSummaryCards = ({ claim }) => {
  const scores = claim?.aiAssessment?.scores || claim?.decision?.scores || {};
  const fraudAssessment = claim?.aiAssessment?.fraudAssessment || claim?.analysis?.fraudAnalysis || {};
  const damageAssessment = claim?.aiAssessment?.damageAssessment || claim?.analysis?.damageAssessment || {};

  const rawFraudScore = scores.fraud !== undefined ? Number(scores.fraud) : (fraudAssessment.overallScore !== undefined ? Number(fraudAssessment.overallScore) : null);
  const fraudScoreOutOf100 = rawFraudScore !== null && !isNaN(rawFraudScore)
    ? Math.min(100, Math.max(0, Math.round(rawFraudScore <= 10 ? rawFraudScore * 10 : rawFraudScore)))
    : null;

  const fraudLevel = fraudAssessment.riskLevel || (
    fraudScoreOutOf100 !== null
      ? (fraudScoreOutOf100 >= 70 ? 'HIGH' : fraudScoreOutOf100 >= 40 ? 'MEDIUM' : 'LOW')
      : null
  );

  const rawDamageScore = scores.damage !== undefined ? Number(scores.damage) : (damageAssessment.score !== undefined ? Number(damageAssessment.score) : null);
  const damageScoreOutOf10 = rawDamageScore !== null && !isNaN(rawDamageScore) ? Number(rawDamageScore.toFixed(1)) : null;

  const damageSeverity = damageAssessment.severity
    ? String(damageAssessment.severity).toUpperCase()
    : (damageScoreOutOf10 !== null
        ? (damageScoreOutOf10 >= 7.5 ? 'SEVERE' : damageScoreOutOf10 >= 4 ? 'MODERATE' : 'MINOR')
        : null);

  const evidenceList = Array.isArray(claim?.evidence) ? claim.evidence : [];
  const evidenceCount = evidenceList.length;
  const hasCompletedEvidence = evidenceList.some(e => e.processingStatus === 'COMPLETED') || !!claim?.annotatedImagePath || !!claim?.primaryAnnotatedKeyframeUrl;
  const evidenceStatus = evidenceCount > 0
    ? (hasCompletedEvidence ? 'COMPLETE' : 'PROCESSING')
    : (claim?.status === 'AI_ASSESSED' ? 'COMPLETE' : 'PENDING');

  const rawConfidence = claim?.aiAssessment?.confidence || claim?.decision?.confidence;
  let aiConfidence = null;
  if (rawConfidence !== undefined && rawConfidence !== null && String(rawConfidence).trim() !== '') {
    const confUpper = String(rawConfidence).toUpperCase();
    if (['HIGH', 'MEDIUM', 'LOW'].includes(confUpper)) {
      aiConfidence = confUpper;
    } else if (!isNaN(Number(rawConfidence))) {
      aiConfidence = `${Math.round(Number(rawConfidence) * 100)}%`;
    } else {
      aiConfidence = String(rawConfidence);
    }
  }

  const getFraudBadgeColor = (level) => {
    switch (level) {
      case 'HIGH':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'MEDIUM':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'LOW':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const getDamageBadgeColor = (severity) => {
    switch (severity) {
      case 'SEVERE':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'MODERATE':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'MINOR':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const getConfidenceBadgeColor = (conf) => {
    switch (conf) {
      case 'HIGH':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'MEDIUM':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'LOW':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-50 text-slate-500 border-slate-200';
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">Fraud Risk</span>
          <span className="p-1.5 rounded bg-slate-50 text-slate-600 border border-slate-100">
            <ShieldAlert size={14} />
          </span>
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <div className="text-2xl font-bold text-slate-900">
            {fraudScoreOutOf100 !== null ? `${fraudScoreOutOf100}` : 'Unavailable'}
            {fraudScoreOutOf100 !== null && (
              <span className="text-xs font-normal text-slate-400 ml-1">/ 100</span>
            )}
          </div>
          {fraudLevel ? (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${getFraudBadgeColor(fraudLevel)}`}>
              {fraudLevel}
            </span>
          ) : (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-200">
              Pending
            </span>
          )}
        </div>
        <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-1.5 rounded-full transition-all duration-300 ${
              fraudLevel === 'HIGH'
                ? 'bg-rose-500'
                : fraudLevel === 'MEDIUM'
                ? 'bg-amber-500'
                : 'bg-emerald-500'
            }`}
            style={{ width: `${fraudScoreOutOf100 !== null ? fraudScoreOutOf100 : 0}%` }}
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">Damage Severity</span>
          <span className="p-1.5 rounded bg-slate-50 text-slate-600 border border-slate-100">
            <AlertTriangle size={14} />
          </span>
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <div className="text-2xl font-bold text-slate-900">
            {damageScoreOutOf10 !== null ? `${damageScoreOutOf10}` : 'Unavailable'}
            {damageScoreOutOf10 !== null && (
              <span className="text-xs font-normal text-slate-400 ml-1">/ 10</span>
            )}
          </div>
          {damageSeverity ? (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${getDamageBadgeColor(damageSeverity)}`}>
              {damageSeverity}
            </span>
          ) : (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-200">
              Pending
            </span>
          )}
        </div>
        <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-1.5 rounded-full transition-all duration-300 ${
              damageSeverity === 'SEVERE'
                ? 'bg-rose-500'
                : damageSeverity === 'MODERATE'
                ? 'bg-amber-500'
                : 'bg-emerald-500'
            }`}
            style={{ width: `${damageScoreOutOf10 !== null ? Math.min(100, damageScoreOutOf10 * 10) : 0}%` }}
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">Evidence Status</span>
          <span className="p-1.5 rounded bg-slate-50 text-slate-600 border border-slate-100">
            <FileCheck size={14} />
          </span>
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <div className="text-2xl font-bold text-slate-900">
            {evidenceCount > 0 ? `${evidenceCount}` : '1'}
            <span className="text-xs font-normal text-slate-400 ml-1">files</span>
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
            evidenceStatus === 'COMPLETE'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-blue-50 text-blue-700 border-blue-200'
          }`}>
            {evidenceStatus}
          </span>
        </div>
        <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-1.5 rounded-full transition-all duration-500 ${
              evidenceStatus === 'COMPLETE' ? 'bg-emerald-500' : 'bg-blue-500 animate-pulse'
            }`}
            style={{ width: evidenceStatus === 'COMPLETE' ? '100%' : '65%' }}
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">AI Confidence</span>
          <span className="p-1.5 rounded bg-slate-50 text-slate-600 border border-slate-100">
            <Sparkles size={14} />
          </span>
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <div className="text-2xl font-bold text-slate-900">
            {aiConfidence || 'Unavailable'}
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${getConfidenceBadgeColor(aiConfidence)}`}>
            {aiConfidence ? 'CALIBRATED' : 'UNAVAILABLE'}
          </span>
        </div>
        <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-1.5 rounded-full transition-all duration-300 ${
              aiConfidence === 'HIGH'
                ? 'bg-emerald-500'
                : aiConfidence === 'MEDIUM'
                ? 'bg-blue-500'
                : aiConfidence === 'LOW'
                ? 'bg-amber-500'
                : 'bg-slate-300'
            }`}
            style={{
              width: aiConfidence === 'HIGH' ? '90%' : aiConfidence === 'MEDIUM' ? '65%' : aiConfidence === 'LOW' ? '35%' : '0%'
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default ClaimSummaryCards;
