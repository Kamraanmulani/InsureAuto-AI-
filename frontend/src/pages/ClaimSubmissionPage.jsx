import React from 'react';
import { useNavigate } from 'react-router-dom';
import ClaimSubmission from '../components/ClaimSubmission';

const ClaimSubmissionPage = () => {
  const navigate = useNavigate();

  const handleClaimSubmitted = (claim) => {
    navigate(`/claim/${claim.jobId}`);
  };

  return <ClaimSubmission onClaimSubmitted={handleClaimSubmitted} />;
};

export default ClaimSubmissionPage;
