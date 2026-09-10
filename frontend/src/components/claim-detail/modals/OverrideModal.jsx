import React, { useState } from 'react';
import { ShieldAlert, X } from 'lucide-react';
import { toast } from 'react-toastify';

const OverrideModal = ({ isOpen, onClose, onSubmit, loading }) => {
  const [overrideData, setOverrideData] = useState({
    newRecommendation: '',
    reason: ''
  });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!overrideData.newRecommendation) {
      toast.error('Please select an override determination.');
      return;
    }
    if (!overrideData.reason.trim()) {
      toast.error('Justification rationale is mandatory for audit compliance.');
      return;
    }
    onSubmit(overrideData.newRecommendation, overrideData.reason);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-150">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-slate-700" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Record Assessor Manual Override
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              New Determination
            </label>
            <select
              value={overrideData.newRecommendation}
              onChange={(e) => setOverrideData({ ...overrideData, newRecommendation: e.target.value })}
              className="w-full text-xs bg-white border border-slate-200 rounded px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              <option value="">Select determination...</option>
              <option value="APPROVE">APPROVE (Fast-track settlement)</option>
              <option value="MANUAL_REVIEW">MANUAL_REVIEW (Special investigation)</option>
              <option value="REJECT">REJECT (Denial based on evidence)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Mandatory Justification Rationale
            </label>
            <textarea
              rows={4}
              value={overrideData.reason}
              onChange={(e) => setOverrideData({ ...overrideData, reason: e.target.value })}
              placeholder="Provide specific justification explaining why model findings are being overridden..."
              className="w-full text-xs bg-white border border-slate-200 rounded p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-medium py-2 rounded transition shadow-sm"
            >
              {loading ? 'Recording Override...' : 'Save Assessor Override'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded border border-slate-200 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OverrideModal;
