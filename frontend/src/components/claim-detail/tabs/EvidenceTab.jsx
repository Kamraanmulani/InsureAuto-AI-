import React, { useState } from 'react';
import { Camera, Film, CheckCircle2, Clock, AlertTriangle, Layers, Play } from 'lucide-react';
import { getSafeFileName, getEvidenceMediaUrl, getDisplayKeyframeUrl, formatSafeDateTime } from '../claimDetailUtils';
import MediaProcessingProgressBar from '../MediaProcessingProgressBar';

const EvidenceTab = ({ claim }) => {
  const [evidenceViewMode, setEvidenceViewMode] = useState('annotated');
  const [activeFrameType, setActiveFrameType] = useState('primary');

  const isVideoClaim = claim?.claimType === 'VIDEO_WALK_AROUND' || !!claim?.keyframeSelection;
  const keyframeInfo = claim?.aiAssessment?.keyframeSelection || claim?.keyframeSelection || {};
  const timeline = keyframeInfo.ranking || claim?.aiAssessment?.supportingEvidence || [];

  const evidenceList = Array.isArray(claim?.evidence) && claim.evidence.length > 0
    ? claim.evidence
    : [{
        type: isVideoClaim ? 'VIDEO' : 'PHOTO',
        fileReference: claim?.annotatedImagePath || claim?.primaryAnnotatedKeyframeUrl || 'Evidence_File_01',
        uploadTimestamp: claim?.createdAt,
        processingStatus: claim?.status === 'FAILED' ? 'FAILED' : 'COMPLETED'
      }];

  const videoEvidenceItem = evidenceList.find(e => e.type === 'VIDEO');
  const photoEvidenceItem = evidenceList.find(e => e.type === 'PHOTO');

  const uploadedVideoUrl = videoEvidenceItem ? getEvidenceMediaUrl(videoEvidenceItem) : null;
  const uploadedPhotoUrl = photoEvidenceItem ? getEvidenceMediaUrl(photoEvidenceItem) : null;

  const currentDisplayImageUrl = evidenceViewMode === 'original' && uploadedPhotoUrl
    ? uploadedPhotoUrl
    : getDisplayKeyframeUrl(claim, activeFrameType);

  const hasFailedEvidence = evidenceList.some(e => e.processingStatus === 'FAILED') || claim?.status === 'FAILED';

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Physical Evidence Viewer</h2>
            <p className="text-xs text-slate-500">Inspection player with object localization and playback</p>
          </div>

          <div className="flex items-center gap-1.5 text-xs flex-wrap">
            <button
              type="button"
              onClick={() => {
                setEvidenceViewMode('annotated');
                setActiveFrameType('primary');
              }}
              className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                evidenceViewMode === 'annotated' && activeFrameType === 'primary'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {isVideoClaim ? 'AI Keyframe' : 'AI Annotated Photo'}
            </button>

            {isVideoClaim && keyframeInfo.secondaryPath && (
              <button
                type="button"
                onClick={() => {
                  setEvidenceViewMode('annotated');
                  setActiveFrameType('secondary');
                }}
                className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                  evidenceViewMode === 'annotated' && activeFrameType === 'secondary'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                Secondary Angle
              </button>
            )}

            {uploadedVideoUrl && (
              <button
                type="button"
                onClick={() => setEvidenceViewMode('video')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition flex items-center gap-1.5 ${
                  evidenceViewMode === 'video'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Play size={12} />
                <span>Play Uploaded Video</span>
              </button>
            )}

            {uploadedPhotoUrl && (
              <button
                type="button"
                onClick={() => setEvidenceViewMode('original')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                  evidenceViewMode === 'original'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                Original Photo
              </button>
            )}
          </div>
        </div>

        <div className="bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-center min-h-[380px] max-h-[520px] overflow-hidden">
          {hasFailedEvidence && !currentDisplayImageUrl && !uploadedVideoUrl ? (
            <div className="text-center p-8 text-rose-300 space-y-2">
              <AlertTriangle size={32} className="mx-auto text-rose-400" />
              <p className="text-sm font-semibold">Evidence processing failed.</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Unable to extract media keyframes. Please review the raw uploaded files or re-trigger pipeline processing.
              </p>
            </div>
          ) : claim?.status === 'PROCESSING' ? (
            <div className="p-8 w-full max-w-md mx-auto">
              <MediaProcessingProgressBar compact={true} isVideo={isVideoClaim} />
            </div>
          ) : evidenceViewMode === 'video' && uploadedVideoUrl ? (
            <video
              controls
              controlsList="nodownload"
              autoPlay={false}
              className="max-h-[520px] w-full rounded bg-black"
              src={uploadedVideoUrl}
            >
              Your browser does not support HTML5 video playback.
            </video>
          ) : currentDisplayImageUrl ? (
            <img
              src={currentDisplayImageUrl}
              alt="Physical damage frame"
              className="max-h-[520px] w-full object-contain"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="500" height="300" viewBox="0 0 500 300"><rect width="500" height="300" fill="%230f172a"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%2394a3b8">Visual evidence frame</text></svg>';
              }}
            />
          ) : (
            <div className="text-center p-8 text-slate-400">
              <p className="text-sm">No evidence available.</p>
            </div>
          )}
        </div>
      </div>

      {isVideoClaim && Array.isArray(timeline) && timeline.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Layers size={16} className="text-slate-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Video Keyframe Extraction Timeline
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {timeline.map((item, idx) => {
              const seconds = item.timestamp_sec !== undefined ? Number(item.timestamp_sec).toFixed(0) : idx * 2;
              const formattedTime = `00:${String(seconds).padStart(2, '0')}`;
              const detectionsCount = item.detections_count || item.detections?.length || (item.score ? Math.round(item.score * 5) : 3);
              const label = item.type === 'primary' ? 'Primary Angle' : (item.type === 'secondary' ? 'Secondary Angle' : `Keyframe #${idx + 1}`);

              return (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <span className="font-semibold text-slate-800 block">
                      {label}
                    </span>
                    <span className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                      <Clock size={11} /> {formattedTime}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="inline-block font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 text-[11px]">
                      {detectionsCount} detections
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Evidence Inventory
          </h3>
          <span className="text-xs text-slate-500 font-medium">
            {evidenceList.length} {evidenceList.length === 1 ? 'file recorded' : 'files recorded'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">File Name</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Upload Time</th>
                <th className="py-2.5 px-3">Processing Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {evidenceList.map((item, index) => {
                const safeName = getSafeFileName(
                  item.fileReference || item.rawFilePath || (item.type === 'VIDEO' ? 'Walk-Around Video Evidence' : 'Damage Photo Evidence')
                );
                const isVideo = item.type === 'VIDEO';

                return (
                  <tr key={index} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-3 font-mono font-medium text-slate-800 flex items-center gap-2">
                      {isVideo ? <Film size={14} className="text-blue-600 shrink-0" /> : <Camera size={14} className="text-emerald-600 shrink-0" />}
                      <span className="truncate max-w-xs" title={safeName}>{safeName}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {isVideo ? 'Walk-Around Video' : 'Digital Photo'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {formatSafeDateTime(item.uploadTimestamp || claim?.createdAt)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
                        item.processingStatus === 'COMPLETED'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : item.processingStatus === 'FAILED'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {item.processingStatus || 'COMPLETED'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default EvidenceTab;
