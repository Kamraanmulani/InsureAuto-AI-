import React from 'react';
import { History, CheckCircle2, AlertTriangle, ArrowRight, User, Cpu } from 'lucide-react';
import { formatSafeDateTime } from '../claimDetailUtils';

const TimelineTab = ({ claim }) => {
  const auditHistory = Array.isArray(claim?.auditHistory) ? claim.auditHistory : [];

  const sanitizeReason = (reason) => {
    if (!reason || typeof reason !== 'string') return 'Event logged.';
    if (reason.includes('evidenceItem is not defined')) {
      return 'Processing failed. Evidence reference encountered an indexing exception.';
    }
    if (reason.includes('Error:') || reason.includes('Traceback')) {
      return 'Processing pipeline reported an inspection exception.';
    }
    return reason;
  };

  const getEventBadge = (action) => {
    if (action.includes('SUBMIT')) {
      return 'bg-slate-100 text-slate-800 border-slate-200';
    }
    if (action.includes('PROCESS') || action.includes('AI')) {
      return 'bg-indigo-50 text-indigo-800 border-indigo-200';
    }
    if (action.includes('APPROV')) {
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    }
    if (action.includes('REJECT') || action.includes('FAIL')) {
      return 'bg-rose-50 text-rose-800 border-rose-200';
    }
    return 'bg-blue-50 text-blue-800 border-blue-200';
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <History size={16} className="text-slate-500" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Adjudication & Lifecycle Timeline
          </h2>
        </div>
        <span className="text-xs text-slate-500 font-medium">
          {auditHistory.length} {auditHistory.length === 1 ? 'event recorded' : 'events recorded'}
        </span>
      </div>

      {auditHistory.length === 0 ? (
        <div className="py-8 text-center text-slate-500 text-xs">
          No audit events recorded.
        </div>
      ) : (
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
          {auditHistory.map((event, index) => {
            const actorName = typeof event.actor === 'object' && event.actor !== null
              ? (event.actor.name || event.actor.email || 'Assessor')
              : (typeof event.actor === 'string' ? event.actor : 'System Engine');

            const isSystem = actorName === 'SYSTEM' || !event.actor;
            const rawReason = typeof event.reason === 'string' ? event.reason : (typeof event.notes === 'string' ? event.notes : '');
            const cleanReason = sanitizeReason(rawReason);

            const prevState = typeof event.previousState === 'object' && event.previousState !== null
              ? (event.previousState.status || JSON.stringify(event.previousState))
              : String(event.previousState || '');

            const nextState = typeof event.newState === 'object' && event.newState !== null
              ? (event.newState.status || JSON.stringify(event.newState))
              : String(event.newState || '');

            return (
              <div key={index} className="relative text-xs">
                <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-slate-400 border-2 border-white ring-2 ring-slate-200" />

                <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide border uppercase ${getEventBadge(String(event.action || ''))}`}>
                        {String(event.action || 'STATUS_UPDATE')}
                      </span>
                      <span className="text-slate-500 font-mono text-[11px]">
                        {formatSafeDateTime(event.timestamp)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-slate-500">
                      {isSystem ? <Cpu size={12} className="text-slate-400" /> : <User size={12} className="text-slate-400" />}
                      <span className="font-medium text-slate-700">{actorName}</span>
                    </div>
                  </div>

                  {(prevState || nextState) && (
                    <div className="flex items-center gap-1.5 text-[11px] font-mono font-medium">
                      <span className="text-slate-500">{prevState || 'INIT'}</span>
                      <ArrowRight size={11} className="text-slate-400" />
                      <span className="text-slate-900 font-semibold">{nextState || 'UPDATED'}</span>
                    </div>
                  )}

                  {cleanReason && (
                    <p className="text-slate-600 text-[11px] leading-relaxed pt-1 border-t border-slate-200/60">
                      {cleanReason}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TimelineTab;
