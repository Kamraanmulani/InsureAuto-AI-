import React, { useState } from 'react';
import { FileText, MapPin, Calendar, Clock, AlertOctagon, ChevronDown, ChevronUp } from 'lucide-react';
import { formatSafeDate } from './claimDetailUtils';

const IncidentSummary = ({ claim }) => {
  const [expanded, setExpanded] = useState(false);
  const incident = claim?.incident || {};
  const claimInfo = claim?.claimInfo || {};

  const incidentDate = formatSafeDate(incident.date || claimInfo.date);
  const incidentTime = incident.time || '12:00 PM';
  const incidentType = incident.incidentType || 'Collision';
  const incidentLocation = incident.location || claimInfo.location || 'Location Unspecified';
  const description = incident.description || claimInfo.description || 'No claimant statement submitted.';

  const isLongDescription = description.length > 200;
  const displayDescription = !expanded && isLongDescription
    ? `${description.slice(0, 200)}...`
    : description;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-slate-500" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Incident Summary
          </h2>
        </div>
        <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700">
          {incidentType}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="flex items-start gap-2">
          <Calendar size={14} className="text-slate-400 mt-0.5 shrink-0" />
          <div>
            <span className="text-[11px] text-slate-400 block">Date & Time</span>
            <span className="font-semibold text-slate-800">
              {incidentDate} • {incidentTime}
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <MapPin size={14} className="text-slate-400 mt-0.5 shrink-0" />
          <div>
            <span className="text-[11px] text-slate-400 block">Location</span>
            <span className="font-semibold text-slate-800 truncate block max-w-xs" title={incidentLocation}>
              {incidentLocation}
            </span>
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100">
        <span className="text-[11px] font-medium text-slate-500 block mb-1.5">
          Claimant Description
        </span>
        <div className="bg-slate-50 p-3 rounded-md border border-slate-200/80 text-xs text-slate-700 leading-relaxed">
          <p>{displayDescription}</p>
          {isLongDescription && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="inline-flex items-center gap-1 mt-2 text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition"
            >
              <span>{expanded ? 'Show less' : 'Show full statement'}</span>
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default IncidentSummary;
