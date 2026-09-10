import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { claimAPI } from '../services/api';

const PoliciesPage = () => {
  const navigate = useNavigate();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPolicy, setSelectedPolicy] = useState(null);

  useEffect(() => {
    const fetchClaims = async () => {
      try {
        setLoading(true);
        const data = await claimAPI.getClaims();
        setClaims(data.claims || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchClaims();
  }, []);

  const policyMap = {};

  claims.forEach((claim) => {
    const pid = claim.policy?.policyNumber || claim.claimInfo?.policyId || 'POL-UNASSIGNED';
    if (!policyMap[pid]) {
      policyMap[pid] = {
        id: pid,
        holder: claim.customer?.name || `Policyholder (${pid})`,
        vehicle: claim.vehicle
          ? `${claim.vehicle.year || ''} ${claim.vehicle.make || ''} ${claim.vehicle.model || ''}`.trim() || 'Vehicle on Record'
          : (claim.metadata?.vehicleInfo || 'Vehicle on Record'),
        coverage: claim.policy?.coverageType || 'Standard Comprehensive',
        deductible: String(claim.policy?.deductible || '₹5,000').replace(/\$/g, '₹'),
        status: 'Active',
        term: claim.policy?.effectiveDate ? `${claim.policy.effectiveDate} – Present` : 'Annual Term',
        claims: []
      };
    }
    policyMap[pid].claims.push(claim);
  });

  const policyList = Object.values(policyMap);

  const filteredPolicies = policyList.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return p.id.toLowerCase().includes(q) || p.holder.toLowerCase().includes(q) || p.vehicle.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">

      <div className="flex justify-between items-center">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search policy ID, holder, or vehicle..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400 text-slate-900"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">Loading policy directory...</div>
        ) : filteredPolicies.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">No policies found matching search criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-medium">
                  <th className="py-2.5 px-4">Policy</th>
                  <th className="py-2.5 px-4">Policyholder</th>
                  <th className="py-2.5 px-4">Vehicle</th>
                  <th className="py-2.5 px-4">Coverage</th>
                  <th className="py-2.5 px-4">Deductible</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Claims</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPolicies.map((policy) => (
                  <tr
                    key={policy.id}
                    onClick={() => setSelectedPolicy(policy)}
                    className="hover:bg-slate-50 cursor-pointer transition"
                  >
                    <td className="py-3 px-4 font-mono font-medium text-slate-900">{policy.id}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">{policy.holder}</td>
                    <td className="py-3 px-4 text-slate-600">{policy.vehicle}</td>
                    <td className="py-3 px-4 text-slate-700">{policy.coverage}</td>
                    <td className="py-3 px-4 text-slate-700 font-medium">{policy.deductible}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        policy.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}>
                        {policy.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-semibold">{policy.claims.length}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPolicy(policy);
                        }}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedPolicy && (
        <div className="fixed inset-0 bg-slate-900/40 flex justify-end z-50">
          <div className="bg-white w-full max-w-md h-full shadow-2xl p-6 overflow-y-auto space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 font-mono">{selectedPolicy.id}</h2>
                <span className="text-xs text-slate-500">{selectedPolicy.holder}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPolicy(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs bg-slate-50 p-4 rounded border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-500">Insured Vehicle:</span>
                <span className="font-medium text-slate-800">{selectedPolicy.vehicle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Coverage Package:</span>
                <span className="text-slate-800">{selectedPolicy.coverage}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Deductible:</span>
                <span className="font-semibold text-slate-900">{selectedPolicy.deductible}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Policy Period:</span>
                <span className="text-slate-700">{selectedPolicy.term}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Underwriting Status:</span>
                <span className="font-medium text-emerald-700">{selectedPolicy.status}</span>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-3">Claims Under Policy</h3>
              {selectedPolicy.claims.length === 0 ? (
                <div className="text-xs text-slate-500 py-6 text-center bg-slate-50 rounded border border-slate-200">
                  No filed claims for this policy.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedPolicy.claims.map((claim) => (
                    <div
                      key={claim.claimId || claim.jobId}
                      onClick={() => navigate(`/claims/${claim.claimId || claim.jobId}`)}
                      className="p-3 bg-white border border-slate-200 rounded hover:border-slate-400 cursor-pointer text-xs transition"
                    >
                      <div className="flex justify-between font-mono font-medium text-slate-900">
                        <span>{claim.claimId || (claim.jobId ? `CLM-${claim.jobId.slice(0, 8).toUpperCase()}` : 'CLM-UNASSIGNED')}</span>
                        <span className="text-slate-500 text-[11px]">
                          {claim.createdAt ? new Date(claim.createdAt).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                      <p className="text-slate-600 mt-1 line-clamp-1">{claim.incident?.description || claim.claimInfo?.description}</p>
                      <div className="mt-2 flex justify-between items-center text-[11px]">
                        <span className="text-slate-500">
                          Status: {claim.status ? claim.status.replace('_', ' ') : (claim.decision?.recommendation || 'Processing')}
                        </span>
                        <span className="text-blue-600 font-medium">View Investigation &rarr;</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PoliciesPage;
