import React from 'react';
import { ArrowRight, CheckCircle2, XCircle, AlertCircle, Info } from 'lucide-react';

const AIRecommendation = ({ claim, onSelectTab }) => {
  const aiAssessment = claim?.aiAssessment || {};
  const decision = claim?.decision || {};
  const recommendation = aiAssessment.recommendation || decision.recommendation || null;

  const rawReasons = aiAssessment.reasons || decision.reasons || [];
  const reasons = Array.isArray(rawReasons) && rawReasons.length > 0
    ? rawReasons.slice(0, 4)
    : [];

  const getOutcomeTheme = (rec) => {
    switch (rec) {
      case 'APPROVE':
        return {
          bg: 'bg-emerald-50/70 border-emerald-200',
          badge: 'bg-emerald-600 text-white',
          text: 'text-emerald-950',
          bulletColor: 'text-emerald-600',
          icon: <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
        };
      case 'REJECT':
        return {
          bg: 'bg-rose-50/70 border-rose-200',
          badge: 'bg-rose-600 text-white',
          text: 'text-rose-950',
          bulletColor: 'text-rose-600',
          icon: <XCircle size={18} className="text-rose-600 shrink-0" />
        };
      case 'MANUAL_REVIEW':
      default:
        return {
          bg: 'bg-amber-50/70 border-amber-200',
          badge: 'bg-amber-600 text-white',
          text: 'text-amber-950',
          bulletColor: 'text-amber-600',
          icon: <AlertCircle size={18} className="text-amber-600 shrink-0" />
        };
    }
  };

  const theme = getOutcomeTheme(recommendation);

  return (
    <div className={`border rounded-lg p-4 transition-all shadow-sm ${theme.bg}`}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-3 border-b border-black/5">
        <div className="flex items-center gap-2.5">
          {theme.icon}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Automated Analysis Advisory
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs font-semibold text-slate-700">AI RECOMMENDATION:</span>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded shadow-sm tracking-wide ${theme.badge}`}>
                {recommendation || 'MANUAL REVIEW REQUIRED'}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSelectTab && onSelectTab('ai_analysis')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 hover:text-blue-600 self-start md:self-auto transition py-1 px-2.5 rounded hover:bg-white/80 border border-transparent hover:border-slate-200"
        >
          <span>View Analysis</span>
          <ArrowRight size={13} />
        </button>
      </div>

      <div className="pt-3 space-y-2">
        {recommendation ? (
          <div>
            {reasons.length > 0 ? (
              <ul className="space-y-1.5 text-xs text-slate-700">
                {reasons.map((reason, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className={`font-bold mt-0.5 ${theme.bulletColor}`}>•</span>
                    <span className="leading-snug">{reason}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-600">
                Evaluation completed based on multi-modal damage localization, fraud signatures, and narrative consistency.
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-600 italic">
            Recommendation unavailable — manual assessment required.
          </p>
        )}

        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1 border-t border-black/5">
          <Info size={13} className="shrink-0 text-slate-400" />
          <span>
            AI recommendation only. Final adjudication remains with the claims assessor.
          </span>
        </div>
      </div>
    </div>
  );
};

export default AIRecommendation;
