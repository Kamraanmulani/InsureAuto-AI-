import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, ArrowUpDown } from 'lucide-react';
import { claimAPI } from '../services/api';

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'needs_review', label: 'Needs Review' },
  { id: 'high_risk', label: 'High Risk' },
  { id: 'processing', label: 'Processing' },
  { id: 'needs_info', label: 'Needs Info' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'closed', label: 'Closed' }
];

const ClaimsListPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [sortBy, setSortBy] = useState('date_desc');

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

  useEffect(() => {
    const q = searchParams.get('q');
    if (q !== null) {
      setSearchQuery(q);
    }
  }, [searchParams]);

  const filteredClaims = claims.filter((claim) => {
    const status = claim.status || '';
    const fraudScore = claim.aiAssessment?.scores?.fraud || claim.decision?.scores?.fraud || 0;
    const aiRec = claim.aiAssessment?.recommendation || claim.decision?.recommendation || '';

    if (activeTab === 'needs_review' && !['PENDING_REVIEW', 'UNDER_REVIEW', 'REVIEW_REQUIRED'].includes(status)) {
      return false;
    }
    if (activeTab === 'high_risk' && !(fraudScore >= 7 || aiRec === 'REJECT')) {
      return false;
    }
    if (activeTab === 'processing' && !['SUBMITTED', 'PROCESSING', 'AI_ASSESSED'].includes(status)) {
      return false;
    }
    if (activeTab === 'needs_info' && status !== 'NEEDS_INFORMATION') {
      return false;
    }
    if (activeTab === 'approved' && status !== 'APPROVED') {
      return false;
    }
    if (activeTab === 'rejected' && status !== 'REJECTED') {
      return false;
    }
    if (activeTab === 'closed' && status !== 'CLOSED') {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const jobId = (claim.jobId || '').toLowerCase();
      const claimId = (claim.claimId || '').toLowerCase();
      const customer = (claim.customer?.name || '').toLowerCase();
      const policyId = (claim.policy?.policyNumber || claim.claimInfo?.policyId || '').toLowerCase();
      const desc = (claim.incident?.description || claim.claimInfo?.description || '').toLowerCase();
      const loc = (claim.incident?.location || claim.claimInfo?.location || '').toLowerCase();
      const vehicle = `${claim.vehicle?.make || ''} ${claim.vehicle?.model || ''} ${claim.vehicle?.registration || ''}`.toLowerCase();
      if (!jobId.includes(q) && !claimId.includes(q) && !customer.includes(q) && !policyId.includes(q) && !desc.includes(q) && !loc.includes(q) && !vehicle.includes(q)) {
        return false;
      }
    }

    return true;
  });

  const sortedClaims = [...filteredClaims].sort((a, b) => {
    const dateA = new Date(a.incident?.date || a.createdAt || 0);
    const dateB = new Date(b.incident?.date || b.createdAt || 0);

    if (sortBy === 'date_desc') return dateB - dateA;
    if (sortBy === 'date_asc') return dateA - dateB;
    if (sortBy === 'risk_desc') {
      const fraudA = a.aiAssessment?.scores?.fraud || a.decision?.scores?.fraud || 0;
      const fraudB = b.aiAssessment?.scores?.fraud || b.decision?.scores?.fraud || 0;
      return fraudB - fraudA;
    }
    if (sortBy === 'damage_desc') {
      const damageA = a.aiAssessment?.scores?.damage || a.decision?.scores?.damage || 0;
      const damageB = b.aiAssessment?.scores?.damage || b.decision?.scores?.damage || 0;
      return damageB - damageA;
    }
    return 0;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'SUBMITTED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">Submitted</span>;
      case 'PROCESSING':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200">Processing</span>;
      case 'AI_ASSESSED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-800 border border-indigo-200">AI Assessed</span>;
      case 'PENDING_REVIEW':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">Pending Review</span>;
      case 'UNDER_REVIEW':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-800 border border-blue-300 font-semibold">Under Review</span>;
      case 'APPROVED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">Approved</span>;
      case 'REJECTED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-50 text-rose-800 border border-rose-200 font-semibold">Rejected</span>;
      case 'NEEDS_INFORMATION':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-50 text-orange-800 border border-orange-200">Needs Info</span>;
      case 'CLOSED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-800 border border-slate-300">Closed</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">{status}</span>;
    }
  };

  const getRiskScoreBadge = (score) => {
    const s = Number(score) || 0;
    if (s >= 7) return <span className="font-semibold text-rose-700">{s.toFixed(1)} / 10</span>;
    if (s >= 4) return <span className="font-semibold text-amber-700">{s.toFixed(1)} / 10</span>;
    return <span className="font-semibold text-emerald-700">{s.toFixed(1)} / 10</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Claims</h1>
          <p className="text-sm text-slate-500 mt-1">Review and manage submitted motor insurance claims.</p>
        </div>
        <div>
          <button
            type="button"
            onClick={() => navigate('/submit')}
            className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded shadow-sm transition"
          >
            New Claim
          </button>
        </div>
      </div>

      <div className="border-b border-slate-200 flex space-x-6 text-sm font-medium overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 transition-colors border-b-2 whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-blue-600 text-slate-900 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search claim, policy, vehicle, description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400 text-slate-900"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <ArrowUpDown size={14} />
            <span>Sort by:</span>
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
          >
            <option value="date_desc">Newest First</option>
            <option value="date_asc">Oldest First</option>
            <option value="risk_desc">Highest Risk</option>
            <option value="damage_desc">Highest Damage Score</option>
          </select>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">Loading claims operational table...</div>
        ) : sortedClaims.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">No claims match the selected view.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-medium">
                  <th className="py-2.5 px-4">Claim ID</th>
                  <th className="py-2.5 px-4">Policy</th>
                  <th className="py-2.5 px-4">Vehicle</th>
                  <th className="py-2.5 px-4">Incident Date</th>
                  <th className="py-2.5 px-4">Damage Score</th>
                  <th className="py-2.5 px-4">Fraud Risk</th>
                  <th className="py-2.5 px-4">Lifecycle State</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedClaims.map((claim) => {
                  const policyNumber = claim.policy?.policyNumber || claim.claimInfo?.policyId || 'Unassigned';
                  const vehicleStr = `${claim.vehicle?.year || ''} ${claim.vehicle?.make || 'Vehicle'} ${claim.vehicle?.model || ''}`.trim();
                  const dateStr = claim.incident?.date || claim.claimInfo?.date || claim.createdAt;
                  const damageScore = claim.aiAssessment?.scores?.damage || claim.decision?.scores?.damage || 0;
                  const fraudScore = claim.aiAssessment?.scores?.fraud || claim.decision?.scores?.fraud || 0;

                  return (
                    <tr
                      key={claim.claimId || claim.jobId}
                      onClick={() => navigate(`/claims/${claim.claimId || claim.jobId}`)}
                      className="hover:bg-slate-50 cursor-pointer transition"
                    >
                      <td className="py-3 px-4 font-mono font-medium text-slate-900">
                        {claim.claimId || (claim.jobId ? `CLM-${claim.jobId.slice(0, 8).toUpperCase()}` : 'CLM-UNASSIGNED')}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800 font-mono">
                        {policyNumber}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        <div>{vehicleStr}</div>
                        <span className="text-[11px] text-slate-400 font-mono">{claim.vehicle?.registration || 'UNREGISTERED'}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {dateStr}
                      </td>
                      <td className="py-3 px-4 text-slate-800 font-medium">
                        {damageScore.toFixed(1)} / 10
                      </td>
                      <td className="py-3 px-4">
                        {getRiskScoreBadge(fraudScore)}
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(claim.status)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/claims/${claim.claimId || claim.jobId}`);
                          }}
                          className="text-xs font-medium text-blue-600 hover:text-blue-800"
                        >
                          Review &rarr;
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClaimsListPage;
