import React from 'react';
import { RefreshCw } from 'lucide-react';

const MediaProcessingProgressBar = ({ isVideo = false, compact = false }) => {
  if (compact) {
    return (
      <div className="w-full p-2.5 bg-slate-900/90 rounded border border-slate-700 text-white text-xs space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1.5 text-slate-300 font-medium">
            <RefreshCw size={11} className="animate-spin text-blue-400" />
            <span>{isVideo ? 'Processing video evidence...' : 'Processing image evidence...'}</span>
          </span>
          <span className="font-mono text-blue-400 font-medium">Analyzing...</span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
          <div className="h-1 rounded-full bg-blue-500 animate-pulse w-3/4" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm space-y-2">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-slate-800 font-medium">
          <RefreshCw size={13} className="animate-spin text-blue-600" />
          <span>
            {isVideo ? 'Processing video walk-around evidence...' : 'Processing damage photo evidence...'}
          </span>
        </div>
        <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-mono">
          Analyzing...
        </span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
        <div className="h-1.5 rounded-full bg-blue-600 animate-pulse w-3/4" />
      </div>
    </div>
  );
};

export default MediaProcessingProgressBar;
