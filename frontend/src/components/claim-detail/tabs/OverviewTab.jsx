import React from 'react';
import IncidentSummary from '../IncidentSummary';
import VehiclePolicyCard from '../VehiclePolicyCard';
import KeyEvidence from '../KeyEvidence';
import AssessorActions from '../AssessorActions';

const OverviewTab = ({
  claim,
  onSelectTab,
  actionLoading,
  retrying,
  onDecisionAction,
  onOpenOverride,
  onOpenReqInfo,
  onRetry
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7 space-y-6">
        <IncidentSummary claim={claim} />
        <VehiclePolicyCard claim={claim} />
      </div>

      <div className="lg:col-span-5 space-y-6">
        <KeyEvidence claim={claim} onSelectTab={onSelectTab} />
        <AssessorActions
          claim={claim}
          actionLoading={actionLoading}
          retrying={retrying}
          onDecisionAction={onDecisionAction}
          onOpenOverride={onOpenOverride}
          onOpenReqInfo={onOpenReqInfo}
          onRetry={onRetry}
        />
      </div>
    </div>
  );
};

export default OverviewTab;
