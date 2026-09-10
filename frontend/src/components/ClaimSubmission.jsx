import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { UploadCloud, X, Film, Camera } from 'lucide-react';
import { claimAPI } from '../services/api';

const ClaimSubmission = ({ onClaimSubmitted }) => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState({
    claim_date: new Date().toISOString().split('T')[0],
    incident_time: '14:30',
    incident_type: 'Vehicle Collision',
    claim_description: '',
    claim_location: '',
    policy_id: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    vehicle_registration: '',
    vehicle_make: '',
    vehicle_model: '',
    vehicle_year: new Date().getFullYear().toString()
  });
  const [mediaFiles, setMediaFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progressStage, setProgressStage] = useState('');

  useEffect(() => {
    return () => {
      mediaFiles.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
  }, [mediaFiles]);

  const handleFiles = (incomingFiles) => {
    if (!incomingFiles || incomingFiles.length === 0) return;
    const added = [];
    Array.from(incomingFiles).forEach((file) => {
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`${file.name} exceeds the 50 MB maximum size limit.`);
        return;
      }
      const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|avi|webm|mkv)$/i.test(file.name);
      added.push({
        id: `${file.name}-${file.size}-${Math.random().toString(36).substring(2, 9)}`,
        file,
        isVideo,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
      });
    });
    if (added.length > 0) {
      setMediaFiles((prev) => [...prev, ...added]);
    }
  };

  const handleRemoveMedia = (idToRemove) => {
    setMediaFiles((prev) => {
      const target = prev.find((item) => item.id === idToRemove);
      if (target && target.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== idToRemove);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (mediaFiles.length === 0) {
      toast.error('Please upload at least one damage photo or walk-around video.');
      return;
    }

    if (!formData.claim_description.trim() || formData.claim_description.trim().length < 8) {
      toast.error('Please provide an accident description (at least 8 characters).');
      return;
    }

    setLoading(true);
    setProgressStage('Uploading and ingesting media evidence...');

    try {
      const submitData = new FormData();
      mediaFiles.forEach((item) => {
        if (item.isVideo) {
          submitData.append('video', item.file);
        } else {
          submitData.append('image', item.file);
        }
        submitData.append('media', item.file);
      });
      submitData.append('claim_date', formData.claim_date);
      submitData.append('incident_time', formData.incident_time);
      submitData.append('incident_type', formData.incident_type);
      submitData.append('claim_description', formData.claim_description);
      submitData.append('claim_location', formData.claim_location || 'Unknown');
      submitData.append('policy_id', formData.policy_id || '');
      submitData.append('customer_name', formData.customer_name);
      submitData.append('customer_email', formData.customer_email);
      submitData.append('customer_phone', formData.customer_phone);
      submitData.append('vehicle_registration', formData.vehicle_registration);
      submitData.append('vehicle_make', formData.vehicle_make);
      submitData.append('vehicle_model', formData.vehicle_model);
      submitData.append('vehicle_year', formData.vehicle_year);

      setProgressStage('Uploading evidence media...');
      const response = await claimAPI.submitClaim(submitData);

      toast.success('Claim created. AI assessment pipeline running in background.');

      if (onClaimSubmitted && response.claim) {
        onClaimSubmitted(response.claim);
      } else if (response.claim?.claimId || response.claim?.jobId) {
        navigate(`/claims/${response.claim.claimId || response.claim.jobId}`);
      } else {
        navigate('/claims');
      }
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || err.response?.data?.details || 'Failed to submit and analyze claim.';
      toast.error(typeof msg === 'object' ? JSON.stringify(msg) : msg);
    } finally {
      setLoading(false);
      setProgressStage('');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded p-6 space-y-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div>
              <label className="block text-xs font-semibold text-slate-800">Media Evidence</label>
              <span className="text-[11px] text-slate-500 block mt-0.5">
                Upload damage photos, walk-around videos, or both.
              </span>
            </div>
            {mediaFiles.length > 0 && (
              <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                {mediaFiles.length} {mediaFiles.length === 1 ? 'file' : 'files'} selected
              </span>
            )}
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded p-6 flex flex-col items-center justify-center cursor-pointer transition ${
              isDragging
                ? 'border-blue-500 bg-blue-50/50'
                : 'border-slate-200 hover:border-slate-400 bg-slate-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = '';
              }}
              className="hidden"
            />
            <UploadCloud size={28} className={isDragging ? 'text-blue-500 mb-2' : 'text-slate-400 mb-2'} />
            <div className="text-center">
              <span className="text-xs font-medium text-slate-700 block">
                Click or drag & drop to upload damage photos or videos
              </span>
              <span className="text-[11px] text-slate-400 block mt-1">
                Supports MP4, MOV, JPG, PNG, WEBP (up to 50 MB per file)
              </span>
            </div>
            <div className="flex items-center gap-4 mt-3 text-[11px] text-slate-500 font-medium">
              <span className="flex items-center gap-1">
                <Camera size={13} className="text-slate-500" /> Damage Photos
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1">
                <Film size={13} className="text-slate-500" /> Walk-Around Videos
              </span>
            </div>
          </div>

          {mediaFiles.length > 0 && (
            <div className="mt-3 space-y-2">
              {mediaFiles.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded text-xs"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    {item.previewUrl ? (
                      <img
                        src={item.previewUrl}
                        alt="Evidence preview"
                        className="w-10 h-10 object-cover rounded border border-slate-200 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0 text-blue-600">
                        <Film size={18} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-800 truncate max-w-xs block">
                          {item.file.name}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                            item.isVideo
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {item.isVideo ? 'Video' : 'Photo'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        {(item.file.size / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveMedia(item.id);
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 pt-4">
          <h2 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-3">Vehicle Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Registration #</label>
              <input
                type="text"
                placeholder="e.g. 7XYZ890"
                value={formData.vehicle_registration}
                onChange={(e) => setFormData({ ...formData, vehicle_registration: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Make</label>
              <input
                type="text"
                placeholder="e.g. Honda"
                value={formData.vehicle_make}
                onChange={(e) => setFormData({ ...formData, vehicle_make: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Model</label>
              <input
                type="text"
                placeholder="e.g. Civic"
                value={formData.vehicle_model}
                onChange={(e) => setFormData({ ...formData, vehicle_model: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Year</label>
              <input
                type="number"
                placeholder="2022"
                value={formData.vehicle_year}
                onChange={(e) => setFormData({ ...formData, vehicle_year: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <h2 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-3">Policy & Claimant</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Policy Identifier</label>
              <input
                type="text"
                placeholder="e.g. POL-4402"
                value={formData.policy_id}
                onChange={(e) => setFormData({ ...formData, policy_id: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Customer Name</label>
              <input
                type="text"
                placeholder="e.g. Robert Vance"
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <h2 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-3">Incident Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs mb-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Incident Date</label>
              <input
                type="date"
                value={formData.claim_date}
                onChange={(e) => setFormData({ ...formData, claim_date: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Time</label>
              <input
                type="time"
                value={formData.incident_time}
                onChange={(e) => setFormData({ ...formData, incident_time: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Incident Type</label>
              <select
                value={formData.incident_type}
                onChange={(e) => setFormData({ ...formData, incident_type: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
              >
                <option value="Vehicle Collision">Vehicle Collision</option>
                <option value="Rear-End Collision">Rear-End Collision</option>
                <option value="Single Vehicle Impact">Single Vehicle Impact</option>
                <option value="Side Swipe / T-Bone">Side Swipe / T-Bone</option>
                <option value="Vandalism / Glass">Vandalism / Glass</option>
                <option value="Weather / Hail">Weather / Hail</option>
              </select>
            </div>
          </div>

          <div className="text-xs mb-3">
            <label className="block text-slate-700 font-medium mb-1">Incident Location</label>
            <input
              type="text"
              placeholder="e.g. Intersection of 5th Ave and Main St"
              value={formData.claim_location}
              onChange={(e) => setFormData({ ...formData, claim_location: e.target.value })}
              className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>

          <div className="text-xs">
            <label className="block text-slate-700 font-medium mb-1">Claimant Accident Description</label>
            <textarea
              rows={3}
              required
              placeholder="Detailed narrative of the incident for consistency verification..."
              value={formData.claim_description}
              onChange={(e) => setFormData({ ...formData, claim_description: e.target.value })}
              className="w-full bg-white border border-slate-200 rounded p-2.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>
        </div>

        {loading && (
          <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs text-slate-600 flex items-center gap-2">
            <span className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
            <span>{progressStage}</span>
          </div>
        )}

        <div className="pt-2 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/claims')}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-medium rounded hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded transition"
          >
            {loading ? 'Submitting...' : 'Submit Claim'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ClaimSubmission;
