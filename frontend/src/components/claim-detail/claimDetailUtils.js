export const getSafeFileName = (fileRef, fallback = 'Evidence File') => {
  if (!fileRef || typeof fileRef !== 'string') return fallback;
  const clean = fileRef.replace(/\\/g, '/');
  const name = clean.split('/').pop();
  if (name && name.trim()) {
    return name.trim();
  }
  return fallback;
};

export const getEvidenceMediaUrl = (evidenceItem) => {
  if (!evidenceItem) return '';
  const rawRef = evidenceItem.fileReference || evidenceItem.rawFilePath || '';
  if (rawRef.startsWith('http://') || rawRef.startsWith('https://')) {
    return rawRef;
  }
  const BACKEND_URL = process.env.REACT_APP_API_URL
    ? process.env.REACT_APP_API_URL.replace(/\/api\/?$/, '')
    : 'http://localhost:5000';

  if (rawRef.startsWith('/uploads/')) {
    return `${BACKEND_URL}${rawRef}`;
  }
  const normalized = rawRef.replace(/\\/g, '/');
  const uploadsIdx = normalized.lastIndexOf('/uploads/');
  if (uploadsIdx !== -1) {
    return `${BACKEND_URL}${normalized.substring(uploadsIdx)}`;
  }
  const filename = normalized.split('/').pop();
  if (!filename) return '';
  return `${BACKEND_URL}/uploads/${filename}`;
};

export const getDisplayKeyframeUrl = (claim, frameType = 'primary') => {
  if (!claim) return '';
  const ML_API_URL = process.env.REACT_APP_ML_API_URL || 'http://localhost:8000';
  const jobId = claim.jobId || claim.claimId || '';

  if (frameType === 'secondary') {
    const keyframeInfo = claim.aiAssessment?.keyframeSelection || claim.keyframeSelection || {};
    if (keyframeInfo.secondaryPath) {
      if (keyframeInfo.secondaryPath.startsWith('http')) return keyframeInfo.secondaryPath;
      return `${ML_API_URL}/api/annotated-keyframe/${jobId}?frame_type=secondary`;
    }
  }

  if (claim.primaryAnnotatedKeyframeUrl) {
    return claim.primaryAnnotatedKeyframeUrl.startsWith('http')
      ? claim.primaryAnnotatedKeyframeUrl
      : `${ML_API_URL}${claim.primaryAnnotatedKeyframeUrl}`;
  }

  if (claim.annotatedImagePath) {
    return claim.annotatedImagePath.startsWith('http')
      ? claim.annotatedImagePath
      : `${ML_API_URL}${claim.annotatedImagePath}`;
  }

  return `${ML_API_URL}/api/annotated-keyframe/${jobId}?frame_type=primary`;
};

export const formatSafeDate = (dateVal) => {
  if (!dateVal) return 'Unavailable';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (e) {
    return String(dateVal);
  }
};

export const formatSafeDateTime = (dateVal) => {
  if (!dateVal) return 'Unavailable';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return `${d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } catch (e) {
    return String(dateVal);
  }
};
