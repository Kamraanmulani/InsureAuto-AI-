import React, { useState, useEffect, useRef } from 'react';
import { 
  AlertCircle, 
  CheckCircle, 
  Loader2, 
  Camera, 
  Video, 
  Film, 
  Sparkles, 
  Info, 
  X 
} from 'lucide-react';
import { claimAPI } from '../services/api';

const PIPELINE_STAGES = [
  { label: 'Ingesting & Validating Media...', progress: 15 },
  { label: 'Extracting Keyframes & Rejecting Motion Blur...', progress: 35 },
  { label: 'Scanning Vehicle Components & Damage with YOLO...', progress: 55 },
  { label: 'Running LLaVA Multi-Modal Damage Reasoning...', progress: 75 },
  { label: 'Checking Temporal Duplicate Signatures & Metadata...', progress: 90 },
  { label: 'Synthesizing Unified Decision Report...', progress: 98 }
];

const ClaimSubmission = ({ onClaimSubmitted }) => {
  const [submissionType, setSubmissionType] = useState('video'); // 'video' | 'image'
  const [formData, setFormData] = useState({
    claim_date: new Date().toISOString().split('T')[0],
    claim_description: '',
    claim_location: '',
    policy_id: ''
  });
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [videoDuration, setVideoDuration] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentStageIdx, setCurrentStageIdx] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const videoRef = useRef(null);

  // Cycle simulated progress steps while loading
  useEffect(() => {
    let interval;
    if (loading) {
      setProgressPercent(15);
      setCurrentStageIdx(0);

      interval = setInterval(() => {
        setCurrentStageIdx((prevIdx) => {
          const nextIdx = Math.min(prevIdx + 1, PIPELINE_STAGES.length - 1);
          setProgressPercent(PIPELINE_STAGES[nextIdx].progress);
          return nextIdx;
        });
      }, 4500);
    } else {
      setProgressPercent(0);
      setCurrentStageIdx(0);
    }

    return () => clearInterval(interval);
  }, [loading]);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleTypeToggle = (type) => {
    if (type !== submissionType) {
      setSubmissionType(type);
      setMediaFile(null);
      setMediaPreview(null);
      setVideoDuration(null);
      setError(null);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setError(null);

    // Max 50MB
    const maxMb = 50;
    if (file.size > maxMb * 1024 * 1024) {
      setError(`Selected file (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds maximum allowed size (${maxMb} MB).`);
      return;
    }

    setMediaFile(file);
    const objectUrl = URL.createObjectURL(file);
    setMediaPreview(objectUrl);

    if (submissionType === 'video') {
      const tempVideo = document.createElement('video');
      tempVideo.src = objectUrl;
      tempVideo.onloadedmetadata = () => {
        setVideoDuration(tempVideo.duration);
        if (tempVideo.duration > 30) {
          setError(`Video duration is ${tempVideo.duration.toFixed(1)}s. Recommended walk-around length is under 30 seconds.`);
        }
      };
    }
  };

  const handleRemoveMedia = () => {
    setMediaFile(null);
    if (mediaPreview) {
      URL.revokeObjectURL(mediaPreview);
    }
    setMediaPreview(null);
    setVideoDuration(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!mediaFile) {
      setError(`Please upload a ${submissionType === 'video' ? 'walk-around video' : 'damage photo'}.`);
      return;
    }

    if (!formData.claim_description || formData.claim_description.trim().length < 10) {
      setError('Please provide a detailed accident description (at least 10 characters).');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const submitData = new FormData();
      if (submissionType === 'video') {
        submitData.append('video', mediaFile);
      } else {
        submitData.append('image', mediaFile);
      }
      submitData.append('claim_date', formData.claim_date);
      submitData.append('claim_description', formData.claim_description);
      submitData.append('claim_location', formData.claim_location || 'Unknown');
      submitData.append('policy_id', formData.policy_id || '');

      const response = await claimAPI.submitClaim(submitData);

      setProgressPercent(100);
      setSuccess('Claim analyzed successfully! Redirecting to report...');
      
      setFormData({
        claim_date: new Date().toISOString().split('T')[0],
        claim_description: '',
        claim_location: '',
        policy_id: ''
      });
      handleRemoveMedia();

      setTimeout(() => {
        if (onClaimSubmitted && response.claim) {
          onClaimSubmitted(response.claim);
        }
      }, 1000);

    } catch (err) {
      const errorMsg = err.response?.data?.details || err.response?.data?.error || err.message || 'Failed to submit claim';
      setError(typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-lg border border-gray-100 p-8">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Sparkles className="text-blue-600" size={24} />
          Submit Insurance Claim
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Upload physical evidence for real-time AI damage quantification, consistency checking, and fraud inspection.
        </p>
      </div>

      {/* Submission Mode Toggle Tabs */}
      <div className="mb-6 bg-gray-100 p-1.5 rounded-xl grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => handleTypeToggle('video')}
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-semibold text-sm transition-all ${
            submissionType === 'video'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Video size={18} />
          Upload Walk-around Video
          <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-bold">Recommended</span>
        </button>

        <button
          type="button"
          onClick={() => handleTypeToggle('image')}
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-semibold text-sm transition-all ${
            submissionType === 'image'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Camera size={18} />
          Upload Single Photo
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
          <div className="text-sm text-red-700 font-medium">{error}</div>
        </div>
      )}

      {/* Success Alert */}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
          <CheckCircle className="text-green-500 flex-shrink-0 mt-0.5" size={20} />
          <div className="text-sm text-green-700 font-medium">{success}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Media Upload & Preview Section */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">
            {submissionType === 'video' ? 'Walk-Around Inspection Video *' : 'Damage Photo *'}
          </label>

          {!mediaPreview ? (
            <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:border-blue-500 hover:bg-blue-50/20 transition-all cursor-pointer">
              <input
                type="file"
                accept={submissionType === 'video' ? 'video/mp4,video/quicktime,video/webm,.mov,.avi,.mkv' : 'image/jpeg,image/png,image/webp'}
                onChange={handleFileChange}
                className="hidden"
                id="media-upload"
              />
              <label htmlFor="media-upload" className="cursor-pointer block">
                {submissionType === 'video' ? (
                  <>
                    <div className="w-16 h-16 mx-auto mb-3 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                      <Film size={32} />
                    </div>
                    <p className="text-base font-semibold text-gray-800">
                      Click or drag to upload walk-around inspection video
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      MP4, MOV, WEBM, AVI (Max 50MB, recommended length: 5–20s)
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 mx-auto mb-3 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                      <Camera size={32} />
                    </div>
                    <p className="text-base font-semibold text-gray-800">
                      Click or drag to upload vehicle damage photo
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      PNG, JPG, WEBM up to 10MB
                    </p>
                  </>
                )}
              </label>
            </div>
          ) : (
            <div className="relative border border-gray-200 rounded-2xl p-4 bg-gray-50">
              <button
                type="button"
                onClick={handleRemoveMedia}
                className="absolute top-6 right-6 z-10 bg-gray-900/80 hover:bg-gray-900 text-white p-1.5 rounded-full shadow-md transition"
                title="Remove file"
              >
                <X size={18} />
              </button>

              {submissionType === 'video' ? (
                <div className="space-y-2">
                  <video
                    ref={videoRef}
                    src={mediaPreview}
                    controls
                    className="max-h-80 w-full rounded-xl bg-black object-contain mx-auto"
                  />
                  <div className="flex items-center justify-between text-xs text-gray-500 px-1 pt-1">
                    <span className="font-medium text-gray-700">{mediaFile?.name}</span>
                    <span>
                      {(mediaFile?.size / (1024 * 1024)).toFixed(2)} MB
                      {videoDuration ? ` • ${videoDuration.toFixed(1)}s duration` : ''}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <img
                    src={mediaPreview}
                    alt="Preview"
                    className="max-h-80 w-full rounded-xl object-contain mx-auto"
                  />
                  <div className="flex items-center justify-between text-xs text-gray-500 px-1 pt-1">
                    <span className="font-medium text-gray-700">{mediaFile?.name}</span>
                    <span>{(mediaFile?.size / (1024 * 1024)).toFixed(2)} MB</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {submissionType === 'video' && (
            <div className="mt-2.5 flex items-center gap-2 text-xs text-blue-700 bg-blue-50/70 p-2.5 rounded-lg border border-blue-100">
              <Info size={16} className="flex-shrink-0" />
              <span>
                <strong>Smart AI Video Pipeline:</strong> Fast 1-FPS adaptive keyframe sampling, blur filtering, YOLO batch inference, and temporal duplicate checks will automatically identify damage locations.
              </span>
            </div>
          )}
        </div>

        {/* Policy & Incident Date */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="policy_id" className="block text-sm font-semibold text-gray-800 mb-1.5">
              Policy / Account ID
            </label>
            <input
              type="text"
              id="policy_id"
              name="policy_id"
              value={formData.policy_id}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="e.g. POL-2026-98124"
            />
          </div>

          <div>
            <label htmlFor="claim_date" className="block text-sm font-semibold text-gray-800 mb-1.5">
              Accident / Incident Date *
            </label>
            <input
              type="date"
              id="claim_date"
              name="claim_date"
              value={formData.claim_date}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              required
            />
          </div>
        </div>

        {/* Location */}
        <div>
          <label htmlFor="claim_location" className="block text-sm font-semibold text-gray-800 mb-1.5">
            Accident Location
          </label>
          <input
            type="text"
            id="claim_location"
            name="claim_location"
            value={formData.claim_location}
            onChange={handleInputChange}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            placeholder="e.g. Highway 48 near Pune Junction"
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="claim_description" className="block text-sm font-semibold text-gray-800 mb-1.5">
            Incident Description *
          </label>
          <textarea
            id="claim_description"
            name="claim_description"
            value={formData.claim_description}
            onChange={handleInputChange}
            rows={4}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            placeholder="Describe what occurred, impacted components (e.g. rear bumper, fender, door), and context..."
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Minimum 10 characters. Our VLM will cross-reference this statement against visual features for consistency scoring.
          </p>
        </div>

        {/* Loading Progress Bar during Analysis */}
        {loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-blue-900">
                <Loader2 className="animate-spin text-blue-600" size={18} />
                {PIPELINE_STAGES[currentStageIdx]?.label}
              </div>
              <span className="text-xs font-bold text-blue-700">{progressPercent}%</span>
            </div>

            <div className="w-full bg-blue-200 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-xs text-blue-600">
              Running multi-stage AI reasoning (YOLOv10 + Ollama LLaVA 13B + Temporal Fingerprinting). This takes ~15–30 seconds.
            </p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !mediaFile}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3.5 px-6 rounded-xl font-semibold shadow-md hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all transform active:scale-[0.99]"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Analyzing {submissionType === 'video' ? 'Video Evidence' : 'Photo'}...
            </>
          ) : (
            <>
              <Sparkles size={18} />
              Submit {submissionType === 'video' ? 'Walk-around Video' : 'Photo'} for Validation
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default ClaimSubmission;
