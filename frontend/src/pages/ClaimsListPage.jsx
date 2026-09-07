import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, ArrowUpDown } from 'lucide-react';
import { claimAPI } from '../services/api';

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'review', label: 'Needs Review' },
  { id: 'high_risk', label: 'High Risk' },
  { id: 'processing', label: 'Processing' },
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
    const rec = claim.decision?.recommendation || '';
    const status = claim.status || '';
    const fraudScore = claim.decision?.scores?.fraud || 0;

    if (activeTab === 'review' && !(rec === 'MANUAL_REVIEW' || status === 'REVIEW_REQUIRED')) {
      return false;
    }
    if (activeTab === 'high_risk' && !(fraudScore >= 7 || rec === 'REJECT')) {
      return false;
    }
    if (activeTab === 'processing' && !(status === 'PROCESSING' || status === 'SUBMITTED')) {
      return false;
    }
    if (activeTab === 'approved' && !(rec === 'APPROVE' || status === 'APPROVED')) {
      return false;
    }
    if (activeTab === 'rejected' && !(rec === 'REJECT' || status === 'REJECTED')) {
      return false;
    }
    if (activeTab === 'closed' && status !== 'CLOSED') {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const jobId = (claim.jobId || '').toLowerCase();
      const policyId = (claim.claimInfo?.policyId || '').toLowerCase();
      const desc = (claim.claimInfo?.description || '').toLowerCase();
      const loc = (claim.claimInfo?.location || '').toLowerCase();
      if (!jobId.includes(q) && !policyId.includes(q) && !desc.includes(q) && !loc.includes(q)) {
        return false;
      }
    }

    return true;
  });

  const sortedClaims = [...filteredClaims].sort((a, b) => {
    if (sortBy === 'date_desc') {
      return new Date(b.createdAt || b.claimInfo?.date || 0) - new Date(a.createdAt || a.claimInfo?.date || 0);
    }
    if (sortBy === 'date_asc') {
      return new Date(a.createdAt || a.claimInfo?.date || 0) - new Date(b.createdAt || b.claimInfo?.date || 0);
    }
    if (sortBy === 'risk_desc') {
      return (b.decision?.scores?.fraud || 0) - (a.decision?.scores?.fraud || 0);
    }
    if (sortBy === 'damage_desc') {
      return (b.decision?.scores?.damage || 0) - (a.decision?.scores?.damage || 0);
    }
    return 0;
  });

  const getStatusBadge = (claim) => {
    const rec = claim.decision?.recommendation || claim.status;
    if (rec === 'APPROVE' || claim.status === 'APPROVED') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
          Approved
        </span>
      );
    }
    if (rec === 'REJECT' || claim.status === 'REJECTED') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-50 text-rose-800 border border-rose-200">
          Rejected
        </span>
      );
    }
    if (rec === 'MANUAL_REVIEW' || claim.status === 'REVIEW_REQUIRED') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
          Needs Review
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
        Processing
      </span>
    );
  };

  const getRiskScoreBadge = (score) => {
    const s = Number(score) || 0;
    if (s >= 7) {
      return <span className="font-semibold text-rose-700">{s.toFixed(1)} / 10</span>;
    }
    if (s >= 4) {
      return <span className="font-semibold text-amber-700">{s.toFixed(1)} / 10</span>;
    }
    return <span className="font-semibold text-emerald-700">{s.toFixed(1)} / 10</span>;
  };

  const getEmptyMessage = () => {
    if (searchQuery) return 'No claims match your search query.';
    if (activeTab === 'high_risk') return 'No high-risk claims.';
    if (activeTab === 'review') return 'No claims awaiting review.';
    if (activeTab === 'closed') return 'No closed claims.';
    return 'No claims yet.';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Claims</h1>
          <p className="text-sm text-slate-500 mt-1">Review and manage submitted claims.</p>
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

      <div className="border-b border-slate-200 flex space-x-6 text-sm font-medium">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 transition-colors border-b-2 ${
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
            placeholder="Search claim, policy, description..."
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
          <div className="py-12 text-center text-xs text-slate-500">{getEmptyMessage()}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-medium">
                  <th className="py-2.5 px-4">Claim ID</th>
                  <th className="py-2.5 px-4">Policy</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">Incident Date</th>
                  <th className="py-2.5 px-4">Damage Score</th>
                  <th className="py-2.5 px-4">Fraud Risk</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedClaims.map((claim) => {
                  const policyId = claim.claimInfo?.policyId || 'Unassigned';
                  const dateStr = claim.claimInfo?.date || claim.createdAt;
                  const formattedDate = dateStr ? new Date(dateStr).toLocaleDateString() : 'N/A';
                  const damageScore = claim.decision?.scores?.damage || 0;
                  const fraudScore = claim.decision?.scores?.fraud || 0;
                  const claimType = claim.claimType === 'VIDEO_WALK_AROUND' ? 'Video Walk-Around' : 'Damage Photo';

                  return (
                    <tr
                      key={claim.jobId}
                      onClick={() => navigate(`/claims/${claim.jobId}`)}
                      className="hover:bg-slate-50 cursor-pointer transition"
                    >
                      <td className="py-3 px-4 font-mono font-medium text-slate-900">
                        CLM-{claim.jobId.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {policyId}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {claimType}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {formattedDate}
                      </td>
                      <td className="py-3 px-4 text-slate-800 font-medium">
                        {damageScore.toFixed(1)} / 10
                      </td>
                      <td className="py-3 px-4">
                        {getRiskScoreBadge(fraudScore)}
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(claim)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/claims/${claim.jobId}`);
                          }}
                          className="text-xs font-medium text-blue-600 hover:text-blue-800"
                        >
                          View Details
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
