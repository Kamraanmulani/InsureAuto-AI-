import React, { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { toast } from 'react-toastify';

const RequestInfoModal = ({ isOpen, onClose, onSubmit, loading }) => {
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!notes.trim()) {
      toast.error('Please describe what information or documentation is required.');
      return;
    }
    onSubmit(notes);
    setNotes('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-150">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <HelpCircle size={18} className="text-orange-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Request Supplemental Information
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
              Required Information or Documentation
            </label>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Specify requested evidence (e.g., additional photos, dashcam footage, or official police report)..."
              className="w-full text-xs bg-white border border-slate-200 rounded p-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-medium py-2 rounded transition shadow-sm"
            >
              {loading ? 'Sending Request...' : 'Send Information Request'}
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

export default RequestInfoModal;
