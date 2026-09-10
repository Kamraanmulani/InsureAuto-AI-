import React from 'react';
import { Sparkles, FileText, CheckCircle2, AlertTriangle, Eye, ShieldCheck } from 'lucide-react';

const AIAnalysisTab = ({ claim }) => {
  const aiAssessment = claim?.aiAssessment || {};
  const damage = aiAssessment.damageAssessment || claim?.analysis?.damageAssessment || {};
  const consistency = aiAssessment.consistencyAssessment || claim?.analysis?.consistencyAnalysis || {};
  const fraud = aiAssessment.fraudAssessment || claim?.analysis?.fraudAnalysis || {};
  const scores = aiAssessment.scores || claim?.decision?.scores || {};
  const incident = claim?.incident || claim?.claimInfo || {};

  const damagedParts = damage.damagedParts || damage.damaged_parts || [];
  const severity = damage.severity || (scores.damage >= 7.5 ? 'Severe' : scores.damage >= 4 ? 'Moderate' : 'Minor');
  const consistencyScore = Number(scores.consistency || consistency.score || 0);
  const isConsistent = consistency.isConsistent !== undefined ? consistency.isConsistent : consistencyScore >= 4;

  const claimantDescription = incident.description || 'Claimant narrative unavailable.';

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Sparkles size={16} className="text-indigo-600" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Multi-Modal Analysis Synthesis
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <FileText size={13} className="text-slate-500" />
                Claimant-Reported Information
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
                Self-Reported
              </span>
            </div>

            <div className="space-y-2 text-xs text-slate-700">
              <div>
                <span className="text-[10px] uppercase font-medium text-slate-400 block">Reported Incident Type</span>
                <span className="font-semibold text-slate-800">{incident.incidentType || 'Collision'}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-medium text-slate-400 block">Reported Description</span>
                <p className="p-2.5 bg-white rounded border border-slate-200/60 text-slate-700 italic leading-relaxed">
                  "{claimantDescription}"
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-medium text-slate-400 block">Impacted Component Claims</span>
                <span className="text-slate-800 font-medium">
                  {incident.reportedDamagedParts?.length > 0 ? incident.reportedDamagedParts.join(', ') : 'Described in incident narrative'}
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Eye size={13} className="text-indigo-600" />
                AI Visual Analysis Findings
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                Independent AI Inspection
              </span>
            </div>

            <div className="space-y-2 text-xs text-slate-700">
              {damagedParts.length > 0 || damage.description ? (
                <>
                  <div>
                    <span className="text-[10px] uppercase font-medium text-slate-400 block">Detected Vehicle Components</span>
                    <ul className="mt-1 space-y-1">
                      {(damagedParts.length > 0 ? damagedParts : ['Localized front body components']).map((part, idx) => (
                        <li key={idx} className="flex items-center gap-1.5 font-medium text-slate-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                          <span>{part}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-medium text-slate-400 block">Evaluated Severity</span>
                    <span className="font-semibold text-slate-900">{severity}</span>
                  </div>
                  {damage.description && (
                    <div>
                      <span className="text-[10px] uppercase font-medium text-slate-400 block">Visual Finding Summary</span>
                      <p className="p-2.5 bg-white rounded border border-slate-200/60 text-slate-700">
                        {damage.description}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-4 text-center text-slate-500">
                  <p className="text-xs">Visual analysis unavailable.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-slate-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Cross-Modal Consistency Assessment
            </h3>
          </div>
          <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded border ${
            isConsistent
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}>
            {isConsistent ? 'Consistent with Visual Evidence' : 'Potential Narrative Contradiction'}
          </span>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200/80">
            <div>
              <span className="text-[10px] uppercase font-semibold text-slate-500 block">Consistency Score</span>
              <span className="text-base font-bold text-slate-900">
                {consistencyScore.toFixed(1)} <span className="text-xs font-normal text-slate-400">/ 10</span>
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-semibold text-slate-500 block">Alignment Rating</span>
              <span className="font-semibold text-slate-800">
                {consistencyScore >= 7 ? 'High Alignment' : consistencyScore >= 4 ? 'Moderate Alignment' : 'Inconsistent'}
              </span>
            </div>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200 text-slate-700 leading-relaxed">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Consistency Reasoning</span>
            <p>
              {consistency.explanation || (isConsistent
                ? 'The visible vehicle damage location and severity align with the claimant\'s reported accident dynamics.'
                : 'Observed damage patterns exhibit discrepancies with how the claimant described the incident.')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAnalysisTab;
