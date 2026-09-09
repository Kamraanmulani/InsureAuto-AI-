export const CLAIM_STATUS = {
  SUBMITTED: 'SUBMITTED',
  PROCESSING: 'PROCESSING',
  AI_ASSESSED: 'AI_ASSESSED',
  PENDING_REVIEW: 'PENDING_REVIEW',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  NEEDS_INFORMATION: 'NEEDS_INFORMATION',
  CLOSED: 'CLOSED'
};

export const ALLOWED_TRANSITIONS = {
  SUBMITTED: ['PROCESSING', 'CLOSED'],
  PROCESSING: ['AI_ASSESSED', 'PENDING_REVIEW', 'CLOSED'],
  AI_ASSESSED: ['PENDING_REVIEW', 'CLOSED'],
  PENDING_REVIEW: ['UNDER_REVIEW', 'NEEDS_INFORMATION', 'CLOSED'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED', 'NEEDS_INFORMATION', 'CLOSED'],
  NEEDS_INFORMATION: ['PROCESSING', 'PENDING_REVIEW', 'UNDER_REVIEW', 'CLOSED'],
  APPROVED: ['CLOSED'],
  REJECTED: ['UNDER_REVIEW', 'CLOSED'],
  CLOSED: []
};

export const canTransition = (currentStatus, targetStatus) => {
  if (!currentStatus || !targetStatus) return false;
  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
  return allowed.includes(targetStatus);
};

export const getAvailableTransitions = (currentStatus) => {
  return ALLOWED_TRANSITIONS[currentStatus] || [];
};

export const isTerminalStatus = (status) => {
  return status === CLAIM_STATUS.CLOSED;
};

export const formatClaimId = (claim) => {
  if (!claim) return '';
  if (claim.claimId) return claim.claimId;
  if (claim.jobId) {
    return claim.jobId.startsWith('CLM-') ? claim.jobId : `CLM-${claim.jobId.slice(0, 8).toUpperCase()}`;
  }
  return '';
};
