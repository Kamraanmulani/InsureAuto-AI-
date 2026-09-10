import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { claimAPI } from '../services/api';
import { CLAIM_STATUS } from '../types/claim';

import ClaimHeader from './claim-detail/ClaimHeader';
import ClaimSummaryCards from './claim-detail/ClaimSummaryCards';
import AIRecommendation from './claim-detail/AIRecommendation';
import ClaimTabs from './claim-detail/ClaimTabs';
import MediaProcessingProgressBar from './claim-detail/MediaProcessingProgressBar';

import OverviewTab from './claim-detail/tabs/OverviewTab';
import EvidenceTab from './claim-detail/tabs/EvidenceTab';
import AIAnalysisTab from './claim-detail/tabs/AIAnalysisTab';
import FraudTab from './claim-detail/tabs/FraudTab';
import DamageTab from './claim-detail/tabs/DamageTab';

import OverrideModal from './claim-detail/modals/OverrideModal';
import RequestInfoModal from './claim-detail/modals/RequestInfoModal';

const ClaimDetail = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();

  const [claim, setClaim] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const [actionLoading, setActionLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [showReqInfoModal, setShowReqInfoModal] = useState(false);

  const loadClaim = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const response = await claimAPI.getClaim(jobId);
      setClaim(response.claim);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load claim record.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [jobId]);

  useEffect(() => {
    loadClaim();
  }, [loadClaim]);

  useEffect(() => {
    if (!claim || claim.status !== CLAIM_STATUS.PROCESSING || claim.processingError?.message) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const res = await claimAPI.getClaim(jobId);
        if (res?.claim) {
          setClaim(res.claim);
          if (res.claim.status !== CLAIM_STATUS.PROCESSING || res.claim.processingError?.message) {
            clearInterval(interval);
          }
        }
      } catch (err) {
        clearInterval(interval);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [claim, jobId]);

  const handleRefresh = () => {
    loadClaim(true);
  };

  const handleRetryProcessing = async () => {
    try {
      setRetrying(true);
      const res = await claimAPI.retryProcessing(claim?.claimId || claim?.jobId || jobId);
      toast.success('Analysis reprocessing initiated.');
      if (res?.claim) {
        setClaim(res.claim);
      } else {
        await loadClaim(true);
      }
    } catch (error) {
      console.error(error);
      const msg = error.response?.data?.error || 'Failed to retry claim processing.';
      toast.error(msg);
    } finally {
      setRetrying(false);
    }
  };

  const handleDecisionAction = async (targetStatus, notes = '') => {
    try {
      setActionLoading(true);
      await claimAPI.updateStatus(claim?.claimId || claim?.jobId || jobId, targetStatus, notes);
      toast.success(`Claim transitioned to ${targetStatus}.`);
      await loadClaim(true);
    } catch (error) {
      console.error(error);
      const msg = error.response?.data?.error || 'Failed to update claim status.';
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOverrideSubmit = async (newRecommendation, reason) => {
    try {
      setActionLoading(true);
      await claimAPI.overrideDecision(
        claim?.claimId || claim?.jobId || jobId,
        newRecommendation,
        reason
      );
      toast.success('Assessor override recorded successfully.');
      setShowOverrideModal(false);
      await loadClaim(true);
    } catch (error) {
      console.error(error);
      const msg = error.response?.data?.error || 'Failed to record decision override.';
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestInfoSubmit = async (notes) => {
    await handleDecisionAction(CLAIM_STATUS.NEEDS_INFORMATION, notes);
    setShowReqInfoModal(false);
  };

  if (loading) {
    return (
      <div className="py-24 text-center max-w-lg mx-auto space-y-3">
        <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-medium text-slate-500">Loading claim investigation workspace...</p>
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 text-center max-w-lg mx-auto my-12 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900">Claim Record Not Found</h2>
        <p className="text-xs text-slate-500">No claim record was found matching ID: {jobId}</p>
        <button
          type="button"
          onClick={() => navigate('/claims')}
          className="px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded hover:bg-slate-800 transition"
        >
          Return to Claims Queue
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <ClaimHeader
        claim={claim}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />

      {claim.status === CLAIM_STATUS.PROCESSING && (
        <MediaProcessingProgressBar
          isVideo={claim.claimType === 'VIDEO_WALK_AROUND' || !!claim.keyframeSelection}
          retrying={retrying}
          onRetry={handleRetryProcessing}
        />
      )}

      <ClaimSummaryCards claim={claim} />

      <AIRecommendation
        claim={claim}
        onSelectTab={setActiveTab}
      />

      <ClaimTabs
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      <div className="transition-all duration-150">
        {activeTab === 'overview' && (
          <OverviewTab
            claim={claim}
            onSelectTab={setActiveTab}
            actionLoading={actionLoading}
            retrying={retrying}
            onDecisionAction={handleDecisionAction}
            onOpenOverride={() => setShowOverrideModal(true)}
            onOpenReqInfo={() => setShowReqInfoModal(true)}
            onRetry={handleRetryProcessing}
          />
        )}

        {activeTab === 'evidence' && (
          <EvidenceTab claim={claim} />
        )}

        {activeTab === 'ai_analysis' && (
          <AIAnalysisTab claim={claim} />
        )}

        {activeTab === 'fraud' && (
          <FraudTab claim={claim} />
        )}

        {activeTab === 'damage' && (
          <DamageTab claim={claim} />
        )}
      </div>

      <OverrideModal
        isOpen={showOverrideModal}
        onClose={() => setShowOverrideModal(false)}
        onSubmit={handleOverrideSubmit}
        loading={actionLoading}
      />

      <RequestInfoModal
        isOpen={showReqInfoModal}
        onClose={() => setShowReqInfoModal(false)}
        onSubmit={handleRequestInfoSubmit}
        loading={actionLoading}
      />
    </div>
  );
};

export default ClaimDetail;
