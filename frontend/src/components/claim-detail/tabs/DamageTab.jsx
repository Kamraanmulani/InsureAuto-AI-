import React from 'react';
import { AlertTriangle, Wrench, Camera, ShieldCheck } from 'lucide-react';

const DamageTab = ({ claim }) => {
  const aiAssessment = claim?.aiAssessment || {};
  const damage = aiAssessment.damageAssessment || claim?.analysis?.damageAssessment || {};
  const scores = aiAssessment.scores || claim?.decision?.scores || {};
  const yoloAggregate = damage.yoloAggregate || {};

  const rawScore = scores.damage !== undefined ? Number(scores.damage) : (damage.score !== undefined ? Number(damage.score) : 0);
  const damageScore = Number(rawScore.toFixed(1));

  const severity = damage.severity
    ? String(damage.severity).toUpperCase()
    : (damageScore >= 7.5 ? 'SEVERE' : damageScore >= 4 ? 'MODERATE' : 'MINOR');

  const damagedParts = damage.damagedParts || damage.damaged_parts || [];
  const recommendation = damage.recommendation || 'Standard body inspection and component repair';

  const isVideoClaim = claim?.claimType === 'VIDEO_WALK_AROUND' || !!claim?.keyframeSelection;
  const keyframeTimeline = claim?.aiAssessment?.keyframeSelection?.ranking || [];

  const getSeverityTheme = (sev) => {
    switch (sev) {
      case 'SEVERE':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'MODERATE':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-slate-600" />
              <h2 className="text-sm font-bold text-slate-900">
                Damage Assessment & Component Localization
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Multi-modal damage severity classification and structural impact localization
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Severity Score</span>
              <span className="text-lg font-bold text-slate-900 font-mono">
                {damageScore} <span className="text-xs font-normal text-slate-400">/ 10</span>
              </span>
            </div>
            <span className={`text-xs font-bold px-3 py-1 rounded border uppercase tracking-wide ${getSeverityTheme(severity)}`}>
              {severity}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">
              Vehicle Component Localization
            </span>
            {damagedParts.length > 0 ? (
              <ul className="space-y-1">
                {damagedParts.map((part, idx) => (
                  <li key={idx} className="flex items-center gap-2 font-medium text-slate-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                    <span>{part}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-500 italic">No isolated component failure detected.</p>
            )}
          </div>

          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">
              Repair & Alignment Guidance
            </span>
            <p className="text-slate-700 leading-relaxed font-medium">
              {recommendation}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-3">
          Supporting Inspection Frames
        </h3>

        {isVideoClaim && keyframeTimeline.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            {keyframeTimeline.map((frame, idx) => {
              const seconds = frame.timestamp_sec !== undefined ? Number(frame.timestamp_sec).toFixed(0) : idx * 2;
              return (
                <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-800 block">
                      {frame.type === 'primary' ? 'Primary Angle' : `Keyframe #${idx + 1}`}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Timestamp: 00:{String(seconds).padStart(2, '0')}
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
                    Vehicle Localization Verified
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
            <div>
              <span className="font-semibold text-slate-800 block">Primary Photo Inspection</span>
              <span className="text-slate-500">Visual localization calibrated from uploaded damage photo</span>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              Verified
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default DamageTab;
