import React from 'react';
import { ShieldAlert, AlertCircle, FileSearch, Copy, Calendar, Camera } from 'lucide-react';

const FraudTab = ({ claim }) => {
  const aiAssessment = claim?.aiAssessment || {};
  const fraud = aiAssessment.fraudAssessment || claim?.analysis?.fraudAnalysis || {};
  const scores = aiAssessment.scores || claim?.decision?.scores || {};
  const pillarBreakdown = aiAssessment.pillarBreakdown || {};

  const rawScore = scores.fraud !== undefined ? Number(scores.fraud) : (fraud.overallScore !== undefined ? Number(fraud.overallScore) : 0);
  const fraudScoreOutOf100 = Math.min(100, Math.max(0, Math.round(rawScore <= 10 ? rawScore * 10 : rawScore)));

  const riskLevel = fraud.riskLevel || (fraudScoreOutOf100 >= 70 ? 'HIGH' : fraudScoreOutOf100 >= 40 ? 'MEDIUM' : 'LOW');

  const videoDup = fraud.videoDuplicateCheck || {};
  const metaFraud = fraud.metadataFraud || {};

  const isDuplicateDetected = Boolean(fraud.isDuplicate || videoDup.isDuplicate || (videoDup.similarityScore && videoDup.similarityScore >= 0.88));
  const duplicateSimPct = videoDup.similarityScore ? Math.round(videoDup.similarityScore * 100) : (isDuplicateDetected ? 100 : 0);

  const editingDetected = Boolean(metaFraud.editingSoftwareDetected);
  const editingTools = metaFraud.editingTools || [];

  const dateDiffDays = pillarBreakdown.metadata_risk?.date_difference_days;
  const isTimelineAnomaly = dateDiffDays !== undefined && dateDiffDays > 7;

  const indicators = [
    {
      title: 'Duplicate Evidence Cross-Check',
      level: isDuplicateDetected ? 'HIGH' : 'LOW',
      detail: isDuplicateDetected
        ? `${duplicateSimPct}% visual hash similarity match identified against repository.`
        : 'Perceptual hash index verified. No duplicate footage detected.',
      signalType: 'Perceptual Hash Index',
      isAnomaly: isDuplicateDetected,
      icon: Copy
    },
    {
      title: 'Evidence Timeline Correlation',
      level: isTimelineAnomaly ? 'MEDIUM' : 'LOW',
      detail: isTimelineAnomaly
        ? `Evidence creation timestamp differs from reported incident by ${dateDiffDays} days.`
        : 'Evidence capture timestamp aligns with reported incident timeline.',
      signalType: 'Metadata Timestamp Verification',
      isAnomaly: isTimelineAnomaly,
      icon: Calendar
    },
    {
      title: 'Digital Editing Artifact Check',
      level: editingDetected ? 'MEDIUM' : 'LOW',
      detail: editingDetected
        ? `Editing signature detected (${editingTools.length > 0 ? editingTools.join(', ') : 'Modified media signature'}).`
        : 'No digital editing software signature or container anomaly detected.',
      signalType: 'Container & EXIF Forensics',
      isAnomaly: editingDetected,
      icon: Camera
    },
    ...(Array.isArray(fraud.fraudIndicators) ? fraud.fraudIndicators.map((ind, idx) => ({
      title: `Pattern Signal #${idx + 1}`,
      level: 'MEDIUM',
      detail: ind,
      signalType: 'Anti-Fraud Pattern Match',
      isAnomaly: true,
      icon: AlertCircle
    })) : [])
  ];

  const getRiskTheme = (lvl) => {
    switch (lvl) {
      case 'HIGH':
        return {
          badge: 'bg-rose-50 text-rose-700 border-rose-200',
          text: 'text-rose-700'
        };
      case 'MEDIUM':
        return {
          badge: 'bg-amber-50 text-amber-700 border-amber-200',
          text: 'text-amber-700'
        };
      default:
        return {
          badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          text: 'text-emerald-700'
        };
    }
  };

  const currentTheme = getRiskTheme(riskLevel);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert size={18} className="text-slate-600" />
              <h2 className="text-sm font-bold text-slate-900">
                Fraud Risk Indicator Analysis
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Automated multi-signal anomaly assessment and media forensics
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Overall Risk</span>
              <span className="text-lg font-bold text-slate-900 font-mono">
                {fraudScoreOutOf100} <span className="text-xs font-normal text-slate-400">/ 100</span>
              </span>
            </div>
            <span className={`text-xs font-bold px-3 py-1 rounded border uppercase tracking-wide ${currentTheme.badge}`}>
              {riskLevel} RISK
            </span>
          </div>
        </div>

        <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 leading-relaxed">
          {riskLevel === 'HIGH' ? (
            <p>
              <strong className="text-slate-900 font-semibold">High fraud-risk indicators detected.</strong> Elevated signals detected in media duplication or metadata timelines. Anomaly verification recommended prior to final settlement.
            </p>
          ) : riskLevel === 'MEDIUM' ? (
            <p>
              <strong className="text-slate-900 font-semibold">Moderate fraud-risk indicators detected.</strong> Certain parameters require standard assessor verification against claimant submission.
            </p>
          ) : (
            <p>
              <strong className="text-slate-900 font-semibold">Low fraud-risk indicators detected.</strong> No significant duplication or metadata anomalies flagged. Standard claim processing path recommended.
            </p>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-3">
          Evaluated Risk Indicators & Anomalies
        </h3>

        <div className="divide-y divide-slate-100">
          {indicators.map((ind, idx) => {
            const Icon = ind.icon;
            const theme = getRiskTheme(ind.level);
            return (
              <div key={idx} className="py-3 flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg border shrink-0 ${
                    ind.isAnomaly
                      ? (ind.level === 'HIGH' ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-amber-50 border-amber-200 text-amber-600')
                      : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}>
                    <Icon size={16} />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">{ind.title}</span>
                      <span className="text-[10px] text-slate-400">• {ind.signalType}</span>
                    </div>
                    <p className="text-slate-600">{ind.detail}</p>
                  </div>
                </div>

                <div className="self-start sm:self-center shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${theme.badge}`}>
                    {ind.level}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default FraudTab;
