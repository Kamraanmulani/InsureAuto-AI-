import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, ShieldCheck } from 'lucide-react';
import { CLAIM_STATUS, formatClaimId } from '../../types/claim';
import { formatSafeDate } from './claimDetailUtils';

const getStatusBadge = (status) => {
  switch (status) {
    case CLAIM_STATUS.SUBMITTED:
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">Submitted</span>;
    case CLAIM_STATUS.PROCESSING:
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200 animate-pulse">Processing</span>;
    case CLAIM_STATUS.AI_ASSESSED:
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200">AI Assessed</span>;
    case CLAIM_STATUS.PENDING_REVIEW:
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">Pending Review</span>;
    case CLAIM_STATUS.UNDER_REVIEW:
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-600 text-white font-medium">Under Review</span>;
    case CLAIM_STATUS.APPROVED:
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">Approved</span>;
    case CLAIM_STATUS.REJECTED:
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">Rejected</span>;
    case CLAIM_STATUS.NEEDS_INFORMATION:
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-orange-50 text-orange-800 border border-orange-200">Needs Information</span>;
    case CLAIM_STATUS.CLOSED:
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-200 text-slate-800 border border-slate-300">Closed</span>;
    default:
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">{status || 'Status Unavailable'}</span>;
  }
};

const ClaimHeader = ({ claim, onRefresh, refreshing }) => {
  const claimCode = formatClaimId(claim);
  const vehicle = claim.vehicle || {};
  const vehicleStr = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Vehicle Unspecified';
  const policyNumber = claim.policy?.policyNumber || claim.claimInfo?.policyId || 'Unavailable';
  const registration = vehicle.registration || vehicle.plate || 'Unavailable';
  const incidentDate = formatSafeDate(claim.incident?.date || claim.claimInfo?.date);
  const policyholder = claim.customer?.name || 'Unavailable';

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <Link
            to="/claims"
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition flex items-center justify-center border border-slate-200"
            title="Return to claims queue"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-bold text-slate-900 font-mono tracking-tight">
                {claimCode}
              </h1>
              {getStatusBadge(claim.status)}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Insurance Claim Investigation Workspace
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-3 text-xs">
        <div>
          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 block">Policy</span>
          <span className="font-semibold text-slate-800 font-mono truncate block" title={policyNumber}>
            {policyNumber}
          </span>
        </div>
        <div>
          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 block">Vehicle</span>
          <span className="font-semibold text-slate-800 truncate block" title={vehicleStr}>
            {vehicleStr}
          </span>
        </div>
        <div>
          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 block">Plate</span>
          <span className="font-semibold text-slate-800 font-mono truncate block" title={registration}>
            {registration}
          </span>
        </div>
        <div>
          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 block">Incident</span>
          <span className="font-semibold text-slate-800 truncate block">
            {incidentDate}
          </span>
        </div>
        <div>
          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 block">Policyholder</span>
          <span className="font-semibold text-slate-800 truncate block" title={policyholder}>
            {policyholder}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ClaimHeader;
