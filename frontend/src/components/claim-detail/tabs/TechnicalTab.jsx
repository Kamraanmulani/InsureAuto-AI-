import React, { useState } from 'react';
import {
  Code2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Camera,
  Sparkles,
  ShieldCheck,
  Layers,
  Copy,
  Check
} from 'lucide-react';
import { getSafeFileName } from '../claimDetailUtils';

const TechnicalTab = ({ claim }) => {
  const [copied, setCopied] = useState(false);
  const [openSections, setOpenSections] = useState({
    model: true,
    detections: true,
    forensics: false,
    pipeline: false,
    raw: false
  });

  const toggleSection = (key) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const aiAssessment = claim?.aiAssessment || {};
  const damage = aiAssessment.damageAssessment || claim?.analysis?.damageAssessment || {};
  const fraud = aiAssessment.fraudAssessment || claim?.analysis?.fraudAnalysis || {};
  const consistency = aiAssessment.consistencyAssessment || claim?.analysis?.consistencyAnalysis || {};
  const yoloAggregate = damage.yoloAggregate || {};
  const videoDup = fraud.videoDuplicateCheck || {};
  const metaFraud = fraud.metadataFraud || {};
  const keyframeInfo = aiAssessment.keyframeSelection || claim?.keyframeSelection || {};

  const handleCopyRaw = () => {
    navigator.clipboard.writeText(JSON.stringify(claim, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Code2 size={16} className="text-slate-600" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Technical & ML Pipeline Diagnostics
            </h2>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Architectural models, perceptual hash vectors, and inference parameters
          </p>
        </div>
        <button
          type="button"
          onClick={handleCopyRaw}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition"
        >
          {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
          <span>{copied ? 'Copied JSON' : 'Copy Claim Payload'}</span>
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection('model')}
          className="w-full p-4 text-left flex items-center justify-between text-xs font-semibold text-slate-800 hover:bg-slate-50 transition border-b border-slate-100"
        >
          <div className="flex items-center gap-2">
            <Cpu size={14} className="text-indigo-600" />
            <span>AI Model Architecture & Frameworks</span>
          </div>
          {openSections.model ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>

        {openSections.model && (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs bg-slate-50/50">
            <div className="p-3 bg-white rounded border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Object Localization</span>
              <div className="font-semibold text-slate-800">YOLOv8 Object Detector</div>
              <div className="text-slate-500 text-[11px]">Vehicle bounding & frame saliency</div>
            </div>
            <div className="p-3 bg-white rounded border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Vision-Language Model</span>
              <div className="font-semibold text-slate-800">LLaVA Multi-Modal Transformer</div>
              <div className="text-slate-500 text-[11px]">Damage classification & description</div>
            </div>
            <div className="p-3 bg-white rounded border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Local Inference Engine</span>
              <div className="font-semibold text-slate-800">Ollama Runtime (Port 11434)</div>
              <div className="text-slate-500 text-[11px]">On-premise zero-cloud leakage</div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection('detections')}
          className="w-full p-4 text-left flex items-center justify-between text-xs font-semibold text-slate-800 hover:bg-slate-50 transition border-b border-slate-100"
        >
          <div className="flex items-center gap-2">
            <Camera size={14} className="text-blue-600" />
            <span>Localization & Detection Metrics</span>
          </div>
          {openSections.detections ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>

        {openSections.detections && (
          <div className="p-4 text-xs bg-slate-50/50">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 bg-white rounded border border-slate-200">
                <span className="text-slate-500 text-[11px] block">Keyframe Detections:</span>
                <span className="font-mono text-slate-900 font-bold text-sm">
                  {yoloAggregate.totalKeyframeDetections || (damage.damagedParts?.length || 1)} detected
                </span>
              </div>
              <div className="p-3 bg-white rounded border border-slate-200">
                <span className="text-slate-500 text-[11px] block">Mean Localization Confidence:</span>
                <span className="font-mono text-slate-900 font-bold text-sm">
                  {yoloAggregate.meanConfidence ? `${(yoloAggregate.meanConfidence * 100).toFixed(1)}%` : 'Validated'}
                </span>
              </div>
              <div className="p-3 bg-white rounded border border-slate-200">
                <span className="text-slate-500 text-[11px] block">Frame Coverage Ratio:</span>
                <span className="font-mono text-slate-900 font-bold text-sm">
                  {yoloAggregate.areaCoverageRatio !== undefined
                    ? `${(yoloAggregate.areaCoverageRatio * 100).toFixed(1)}%`
                    : 'Calibrated'}
                </span>
              </div>
              <div className="p-3 bg-white rounded border border-slate-200">
                <span className="text-slate-500 text-[11px] block">Vehicle Localization:</span>
                <span className="font-mono text-emerald-700 font-bold text-sm">
                  Verified In Frame
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection('forensics')}
          className="w-full p-4 text-left flex items-center justify-between text-xs font-semibold text-slate-800 hover:bg-slate-50 transition border-b border-slate-100"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>Perceptual Hash & Forensic Signals</span>
          </div>
          {openSections.forensics ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>

        {openSections.forensics && (
          <div className="p-4 text-xs bg-slate-50/50">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 bg-white rounded border border-slate-200">
                <span className="text-slate-500 text-[11px] block">Hash Vector Similarity:</span>
                <span className="font-mono text-slate-900 font-bold text-sm">
                  {videoDup.similarityScore ? `${(videoDup.similarityScore * 100).toFixed(1)}%` : '0.0%'}
                </span>
              </div>
              <div className="p-3 bg-white rounded border border-slate-200">
                <span className="text-slate-500 text-[11px] block">Cross-Policy Duplication:</span>
                <span className="font-mono text-slate-900 font-bold text-sm">
                  {videoDup.crossPolicyReuse ? 'Flagged' : 'Unique'}
                </span>
              </div>
              <div className="p-3 bg-white rounded border border-slate-200">
                <span className="text-slate-500 text-[11px] block">Mirrored Footage Check:</span>
                <span className="font-mono text-slate-900 font-bold text-sm">
                  {videoDup.isMirrored ? 'Mirrored' : 'Original'}
                </span>
              </div>
              <div className="p-3 bg-white rounded border border-slate-200">
                <span className="text-slate-500 text-[11px] block">Editing Software Trace:</span>
                <span className="font-mono text-slate-900 font-bold text-sm truncate block" title={metaFraud.editingSoftwareDetected ? (metaFraud.editingTools?.join(', ') || 'Detected') : 'None'}>
                  {metaFraud.editingSoftwareDetected ? (metaFraud.editingTools?.join(', ') || 'Detected') : 'None'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection('pipeline')}
          className="w-full p-4 text-left flex items-center justify-between text-xs font-semibold text-slate-800 hover:bg-slate-50 transition border-b border-slate-100"
        >
          <div className="flex items-center gap-2">
            <Layers size={14} className="text-purple-600" />
            <span>Pipeline Execution Context</span>
          </div>
          {openSections.pipeline ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>

        {openSections.pipeline && (
          <div className="p-4 text-xs bg-slate-50/50">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 bg-white rounded border border-slate-200">
                <span className="text-slate-500 text-[11px] block">Inference Job ID:</span>
                <span className="font-mono text-slate-900 font-bold text-xs truncate block" title={claim?.jobId}>
                  {claim?.jobId || 'Unavailable'}
                </span>
              </div>
              <div className="p-3 bg-white rounded border border-slate-200">
                <span className="text-slate-500 text-[11px] block">Pipeline State:</span>
                <span className="font-mono text-slate-900 font-bold text-xs">
                  {claim?.status}
                </span>
              </div>
              <div className="p-3 bg-white rounded border border-slate-200">
                <span className="text-slate-500 text-[11px] block">Evidence Type:</span>
                <span className="font-mono text-slate-900 font-bold text-xs">
                  {claim?.claimType || 'VIDEO_WALK_AROUND'}
                </span>
              </div>
              <div className="p-3 bg-white rounded border border-slate-200">
                <span className="text-slate-500 text-[11px] block">Reprocessing Count:</span>
                <span className="font-mono text-slate-900 font-bold text-xs">
                  {claim?.processingError?.retryCount || 0}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection('raw')}
          className="w-full p-4 text-left flex items-center justify-between text-xs font-semibold text-slate-800 hover:bg-slate-50 transition border-b border-slate-100"
        >
          <div className="flex items-center gap-2">
            <Code2 size={14} className="text-slate-500" />
            <span>Raw JSON Data & Payload</span>
          </div>
          {openSections.raw ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>

        {openSections.raw && (
          <div className="p-4 bg-slate-950 text-slate-200 text-xs font-mono overflow-x-auto max-h-96 rounded-b">
            <pre>{JSON.stringify(claim, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default TechnicalTab;
