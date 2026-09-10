import React from 'react';
import { ShieldCheck, UserCheck, AlertTriangle, CheckCircle2, XCircle, HelpCircle, RotateCcw } from 'lucide-react';
import { CLAIM_STATUS } from '../../types/claim';

const AssessorActions = ({
  claim,
  actionLoading,
  retrying,
  onDecisionAction,
  onOpenOverride,
  onOpenReqInfo,
  onRetry
}) => {
  const status = claim?.status;
  const decision = claim?.decision || {};
  const aiRecommendation = claim?.aiAssessment?.recommendation || decision.recommendation || 'MANUAL_REVIEW';
  const hasProcessingError = !!claim?.processingError?.message;

  const getRecommendationBadge = (rec) => {
    switch (rec) {
      case 'APPROVE':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">APPROVE</span>;
      case 'REJECT':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">REJECT</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">MANUAL REVIEW</span>;
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <UserCheck size={16} className="text-slate-500" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Assessor Adjudication Workspace
          </h2>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-500 text-[11px]">AI Recommendation:</span>
          {getRecommendationBadge(aiRecommendation)}
        </div>
      </div>

      {decision.outcome && decision.outcome !== 'PENDING' && (
        <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-md text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-blue-900 uppercase text-[10px] tracking-wider">
              Recorded Adjudication
            </span>
            <span className="font-bold text-slate-900">{decision.outcome}</span>
          </div>
          <div className="flex justify-between text-slate-600 text-[11px]">
            <span>Assessor:</span>
            <span className="font-medium text-slate-800">{decision.decisionMaker?.name || 'Assigned Assessor'}</span>
          </div>
          {decision.reason && (
            <p className="text-[11px] text-slate-700 italic bg-white p-2 rounded border border-blue-100 mt-1">
              "{decision.reason}"
            </p>
          )}
        </div>
      )}

      {status === CLAIM_STATUS.CLOSED ? (
        <div className="p-4 bg-slate-50 rounded border border-slate-200 text-xs text-slate-600 text-center">
          Claim is closed. Lifecycle is terminal and no further status modifications can be applied.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Available Assessor Actions
          </div>

          {status === CLAIM_STATUS.AI_ASSESSED && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => onDecisionAction(CLAIM_STATUS.PENDING_REVIEW, 'Claim moved to inspection queue')}
                className="py-2 px-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-medium rounded transition shadow-sm"
              >
                Queue for Assessor Review
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => onDecisionAction(CLAIM_STATUS.UNDER_REVIEW, 'Assessor took immediate ownership')}
                className="py-2 px-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded transition shadow-sm"
              >
                Review Immediately
              </button>
            </div>
          )}

          {['PENDING_REVIEW', 'NEEDS_INFORMATION'].includes(status) && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => onDecisionAction(CLAIM_STATUS.UNDER_REVIEW, 'Assessor began active review')}
              className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded transition shadow-sm"
            >
              Start Investigation (Move to Under Review)
            </button>
          )}

          {status === CLAIM_STATUS.UNDER_REVIEW && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => onDecisionAction(CLAIM_STATUS.APPROVED, 'Claim approved following evidence review')}
                  className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-medium rounded transition shadow-sm flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 size={13} />
                  <span>Approve Claim</span>
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={onOpenReqInfo}
                  className="py-2 px-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-medium rounded transition shadow-sm flex items-center justify-center gap-1.5"
                >
                  <HelpCircle size={13} />
                  <span>Request Information</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => onDecisionAction(CLAIM_STATUS.REJECTED, 'Claim rejected based on evidence inconsistencies')}
                  className="py-2 px-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-medium rounded transition shadow-sm flex items-center justify-center gap-1.5"
                >
                  <XCircle size={13} />
                  <span>Reject Claim</span>
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={onOpenOverride}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-xs font-medium rounded transition shadow-sm"
                >
                  Manual Override
                </button>
              </div>
            </div>
          )}

          {status === CLAIM_STATUS.SUBMITTED && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => onDecisionAction(CLAIM_STATUS.PROCESSING, 'Automated processing initiated')}
                className="py-2 px-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded transition shadow-sm"
              >
                Begin Processing
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => onDecisionAction(CLAIM_STATUS.CLOSED, 'Claim submission cancelled')}
                className="py-2 px-3 bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-medium rounded transition"
              >
                Close Claim
              </button>
            </div>
          )}

          {status === CLAIM_STATUS.PROCESSING && (
            <div className="space-y-2">
              {hasProcessingError ? (
                <button
                  type="button"
                  disabled={retrying}
                  onClick={onRetry}
                  className="w-full py-2 px-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-medium rounded transition shadow-sm flex items-center justify-center gap-1.5"
                >
                  <RotateCcw size={13} className={retrying ? 'animate-spin' : ''} />
                  <span>{retrying ? 'Retrying Pipeline...' : 'Retry Processing Pipeline'}</span>
                </button>
              ) : (
                <div className="p-3 bg-blue-50/60 rounded border border-blue-100 text-center text-xs text-blue-900">
                  AI assessment running in background. Actions enable once analysis completes.
                </div>
              )}
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => onDecisionAction(CLAIM_STATUS.CLOSED, 'Processing cancelled and claim closed')}
                className="w-full py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded transition border border-slate-200"
              >
                Cancel & Close Claim
              </button>
            </div>
          )}

          {['APPROVED', 'REJECTED'].includes(status) && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => onDecisionAction(CLAIM_STATUS.CLOSED, 'Settlement completed. Claim archived.')}
              className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-xs font-medium rounded transition shadow-sm"
            >
              Archive & Close Claim
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default AssessorActions;
