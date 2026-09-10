import React from 'react';
import { Shield, Car, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const VehiclePolicyCard = ({ claim }) => {
  const vehicle = claim?.vehicle || {};
  const policy = claim?.policy || {};
  const claimInfo = claim?.claimInfo || {};

  const vehicleName = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Standard Vehicle';
  const vin = vehicle.vin && vehicle.vin !== 'N/A' ? vehicle.vin : 'VIN Unavailable';
  const registration = vehicle.registration || vehicle.plate || 'Unregistered';

  const policyNumber = policy.policyNumber || claimInfo.policyId || 'POL-UNASSIGNED';
  const policyType = policy.policyType || 'Comprehensive Motor';
  const coverageType = policy.coverageType || 'Collision & Comprehensive';
  const deductible = String(policy.deductible || '₹5,000').replace(/\$/g, '₹');

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Car size={16} className="text-slate-500" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Vehicle & Policy
          </h2>
        </div>
        <Link
          to="/policies"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition"
        >
          <span>View Policies</span>
          <ExternalLink size={11} />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div className="space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Insured Vehicle
          </span>
          <div>
            <span className="text-slate-400 text-[11px] block">Make & Model</span>
            <span className="font-semibold text-slate-800 block truncate" title={vehicleName}>
              {vehicleName}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-slate-400 text-[11px] block">Plate / Reg</span>
              <span className="font-semibold text-slate-800 font-mono block">
                {registration}
              </span>
            </div>
            <div>
              <span className="text-slate-400 text-[11px] block">VIN</span>
              <span className="font-semibold text-slate-800 font-mono text-[11px] block truncate" title={vin}>
                {vin}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-2 border-t sm:border-t-0 sm:border-l sm:pl-4 border-slate-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Policy Coverage
          </span>
          <div>
            <span className="text-slate-400 text-[11px] block">Policy Number</span>
            <span className="font-semibold text-slate-800 font-mono block">
              {policyNumber}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-slate-400 text-[11px] block">Type & Plan</span>
              <span className="font-semibold text-slate-800 block truncate" title={policyType}>
                {policyType}
              </span>
            </div>
            <div>
              <span className="text-slate-400 text-[11px] block">Deductible</span>
              <span className="font-semibold text-emerald-700 block">
                {deductible}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VehiclePolicyCard;
