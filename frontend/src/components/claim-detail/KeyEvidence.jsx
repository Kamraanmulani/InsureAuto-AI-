import React from 'react';
import { Camera, Film, ArrowRight, AlertTriangle, Layers } from 'lucide-react';
import { getSafeFileName, getEvidenceMediaUrl, getDisplayKeyframeUrl, formatSafeDateTime } from './claimDetailUtils';
import MediaProcessingProgressBar from './MediaProcessingProgressBar';

const KeyEvidence = ({ claim, onSelectTab }) => {
  const isVideoClaim = claim?.claimType === 'VIDEO_WALK_AROUND' || !!claim?.keyframeSelection;
  const evidenceList = Array.isArray(claim?.evidence) ? claim.evidence : [];
  const primaryEvidence = evidenceList[0] || null;

  const rawFileRef = primaryEvidence?.fileReference || primaryEvidence?.rawFilePath || claim?.annotatedImagePath || claim?.primaryAnnotatedKeyframeUrl || '';
  const safeFileName = getSafeFileName(rawFileRef, isVideoClaim ? 'Walk-Around Video Evidence' : 'Damage Photo Evidence');
  const uploadTime = formatSafeDateTime(primaryEvidence?.uploadTimestamp || claim?.createdAt);
  const keyframesCount = claim?.aiAssessment?.keyframeSelection?.ranking?.length || (isVideoClaim ? 3 : 1);

  const isProcessing = claim?.status === 'PROCESSING' || primaryEvidence?.processingStatus === 'PROCESSING';
  const videoUrl = primaryEvidence?.type === 'VIDEO' ? getEvidenceMediaUrl(primaryEvidence) : null;
  const imageUrl = getDisplayKeyframeUrl(claim, 'primary');

  const hasEvidenceError = primaryEvidence?.processingStatus === 'FAILED' || claim?.status === 'FAILED';

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          {isVideoClaim ? (
            <Film size={16} className="text-blue-600" />
          ) : (
            <Camera size={16} className="text-emerald-600" />
          )}
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Key Evidence
          </h2>
        </div>
        <button
          type="button"
          onClick={() => onSelectTab && onSelectTab('evidence')}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition"
        >
          <span>View all evidence</span>
          <ArrowRight size={11} />
        </button>
      </div>

      <div className="bg-slate-950 rounded-lg overflow-hidden border border-slate-200 flex items-center justify-center min-h-[220px] max-h-[280px] relative">
        {hasEvidenceError ? (
          <div className="p-6 text-center text-rose-300 space-y-2">
            <AlertTriangle size={24} className="mx-auto text-rose-400" />
            <p className="text-xs font-medium">Evidence processing failed.</p>
            <span className="text-[11px] text-slate-400 block">Assessor review required</span>
          </div>
        ) : isProcessing ? (
          <div className="w-full h-full p-6 flex flex-col items-center justify-center space-y-3 bg-slate-900">
            <MediaProcessingProgressBar compact={true} isVideo={isVideoClaim} />
          </div>
        ) : videoUrl ? (
          <video
            src={videoUrl}
            controls
            controlsList="nodownload"
            className="w-full h-full max-h-[280px] object-contain bg-black"
          >
            Your browser does not support HTML5 video.
          </video>
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt="Key evidence frame"
            className="w-full h-full max-h-[280px] object-contain"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240" viewBox="0 0 400 240"><rect width="400" height="240" fill="%230f172a"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="12" fill="%2394a3b8">Visual evidence frame</text></svg>';
            }}
          />
        ) : (
          <div className="p-6 text-center text-slate-400">
            <p className="text-xs">No evidence available.</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-xs">
        <div className="col-span-2 sm:col-span-1">
          <span className="text-[10px] uppercase font-medium text-slate-400 block">File Name</span>
          <span className="font-semibold text-slate-800 font-mono text-[11px] truncate block" title={safeFileName}>
            {safeFileName}
          </span>
        </div>
        <div>
          <span className="text-[10px] uppercase font-medium text-slate-400 block">Format</span>
          <span className="font-semibold text-slate-800 block">
            {isVideoClaim ? 'Walk-Around Video' : 'Digital Photo'}
          </span>
        </div>
        <div>
          <span className="text-[10px] uppercase font-medium text-slate-400 block">Timeline / Keyframes</span>
          <span className="font-semibold text-slate-800 block">
            {isVideoClaim ? `${keyframesCount} Keyframes` : '1 Frame'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default KeyEvidence;
