import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { UploadCloud, X, Film, Camera } from 'lucide-react';
import { claimAPI } from '../services/api';

const ClaimSubmission = ({ onClaimSubmitted }) => {
  const navigate = useNavigate();
  const [submissionType, setSubmissionType] = useState('video');
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
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progressStage, setProgressStage] = useState('');

  const handleTypeToggle = (type) => {
    if (type !== submissionType) {
      setSubmissionType(type);
      setMediaFile(null);
      if (mediaPreview) URL.revokeObjectURL(mediaPreview);
      setMediaPreview(null);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error('File exceeds the 50 MB maximum size limit.');
      return;
    }

    setMediaFile(file);
    const objectUrl = URL.createObjectURL(file);
    setMediaPreview(objectUrl);
  };

  const handleRemoveMedia = () => {
    setMediaFile(null);
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaPreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!mediaFile) {
      toast.error(`Please select a ${submissionType === 'video' ? 'walk-around video' : 'damage photo'}.`);
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
      if (submissionType === 'video') {
        submitData.append('video', mediaFile);
      } else {
        submitData.append('image', mediaFile);
      }
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
          <label className="block text-xs font-semibold text-slate-800 mb-2">Evidence Submission Mode</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleTypeToggle('video')}
              className={`p-3 rounded border text-left flex items-start gap-3 transition ${
                submissionType === 'video'
                  ? 'border-blue-600 bg-blue-50/50'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <Film size={18} className={submissionType === 'video' ? 'text-blue-600' : 'text-slate-400'} />
              <div>
                <span className="text-xs font-semibold text-slate-900 block">Walk-Around Video</span>
                <span className="text-[11px] text-slate-500 block mt-0.5">Multi-angle video file (MP4, MOV)</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleTypeToggle('image')}
              className={`p-3 rounded border text-left flex items-start gap-3 transition ${
                submissionType === 'image'
                  ? 'border-blue-600 bg-blue-50/50'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <Camera size={18} className={submissionType === 'image' ? 'text-blue-600' : 'text-slate-400'} />
              <div>
                <span className="text-xs font-semibold text-slate-900 block">Single Damage Photo</span>
                <span className="text-[11px] text-slate-500 block mt-0.5">High-resolution image (JPG, PNG)</span>
              </div>
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-800 mb-2">Media File</label>
          {!mediaPreview ? (
            <label className="border-2 border-dashed border-slate-200 rounded p-8 flex flex-col items-center justify-center cursor-pointer hover:border-slate-400 bg-slate-50 transition">
              <UploadCloud size={24} className="text-slate-400 mb-2" />
              <span className="text-xs font-medium text-slate-700">
                Click to upload {submissionType === 'video' ? 'walk-around video' : 'damage photo'}
              </span>
              <span className="text-[11px] text-slate-400 mt-1">
                {submissionType === 'video' ? 'MP4 or MOV up to 50 MB' : 'JPG or PNG up to 50 MB'}
              </span>
              <input
                type="file"
                accept={submissionType === 'video' ? 'video/mp4,video/quicktime' : 'image/jpeg,image/png'}
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          ) : (
            <div className="relative border border-slate-200 rounded p-3 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-slate-800 truncate max-w-xs">{mediaFile?.name}</span>
                <span className="text-[11px] text-slate-400">({(mediaFile?.size / (1024 * 1024)).toFixed(1)} MB)</span>
              </div>
              <button
                type="button"
                onClick={handleRemoveMedia}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X size={16} />
              </button>
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
