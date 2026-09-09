import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { claimAPI } from '../services/api';

const ClaimsDashboard = () => {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchClaims = async () => {
      try {
        setLoading(true);
        const data = await claimAPI.getClaims();
        setClaims(data.claims || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchClaims();
  }, []);

  const needsReviewCount = claims.filter(c =>
    ['PENDING_REVIEW', 'UNDER_REVIEW', 'REVIEW_REQUIRED'].includes(c.status)
  ).length;

  const highRiskCount = claims.filter(c => {
    const fraud = c.aiAssessment?.scores?.fraud || c.decision?.scores?.fraud || 0;
    const rec = c.aiAssessment?.recommendation || c.decision?.recommendation || '';
    return fraud >= 7 || rec === 'REJECT';
  }).length;

  const processingCount = claims.filter(c =>
    ['SUBMITTED', 'PROCESSING', 'AI_ASSESSED'].includes(c.status)
  ).length;

  const completedCount = claims.filter(c =>
    ['APPROVED', 'REJECTED', 'CLOSED'].includes(c.status)
  ).length;

  const priorityClaims = claims.filter(c =>
    ['PENDING_REVIEW', 'UNDER_REVIEW', 'NEEDS_INFORMATION'].includes(c.status) ||
    ((c.aiAssessment?.scores?.fraud || 0) >= 6)
  ).slice(0, 6);

  const displayPriority = priorityClaims.length > 0 ? priorityClaims : claims.slice(0, 6);

  const chartData = [
    { name: 'Approve', count: claims.filter(c => (c.aiAssessment?.recommendation || c.decision?.recommendation) === 'APPROVE').length },
    { name: 'Review', count: claims.filter(c => (c.aiAssessment?.recommendation || c.decision?.recommendation) === 'MANUAL_REVIEW').length },
    { name: 'Reject', count: claims.filter(c => (c.aiAssessment?.recommendation || c.decision?.recommendation) === 'REJECT').length },
    { name: 'Needs Info', count: claims.filter(c => c.status === 'NEEDS_INFORMATION').length }
  ];

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

  const getRiskIndicator = (score) => {
    const s = Number(score) || 0;
    if (s >= 7) return <span className="text-xs font-semibold text-rose-700">High ({s.toFixed(1)})</span>;
    if (s >= 4) return <span className="text-xs font-semibold text-amber-700">Medium ({s.toFixed(1)})</span>;
    return <span className="text-xs font-semibold text-emerald-700">Low ({s.toFixed(1)})</span>;
  };

  const calculateAge = (dateString) => {
    if (!dateString) return 'Today';
    const diff = Math.floor((new Date() - new Date(dateString)) / (1000 * 60 * 60 * 24));
    if (diff <= 0) return 'Today';
    if (diff === 1) return '1d ago';
    return `${diff}d ago`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Claims overview</h1>
          <p className="text-sm text-slate-500 mt-1">
            Operational triage and attention items across motor insurance claims.
          </p>
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded border border-slate-200">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Needs Review</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{needsReviewCount}</span>
            <span className="text-xs text-amber-700 font-medium">Pending assessor</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded border border-slate-200">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">High Risk</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-rose-700">{highRiskCount}</span>
            <span className="text-xs text-rose-600 font-medium">Flagged</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded border border-slate-200">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Processing</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{processingCount}</span>
            <span className="text-xs text-slate-500">Pipeline active</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded border border-slate-200">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Recently Completed</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{completedCount}</span>
            <span className="text-xs text-emerald-700 font-medium">Settled / Closed</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Priority Claims</h2>
                <p className="text-xs text-slate-500 mt-0.5">Claims requiring review or intervention.</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/claims')}
                className="text-xs font-medium text-blue-600 hover:text-blue-800"
              >
                View all claims &rarr;
              </button>
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500">Loading claims data...</div>
            ) : displayPriority.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">No priority claims requiring attention.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-medium">
                      <th className="py-2.5 px-4">Claim</th>
                      <th className="py-2.5 px-4">Customer</th>
                      <th className="py-2.5 px-4">Vehicle</th>
                      <th className="py-2.5 px-4">Lifecycle State</th>
                      <th className="py-2.5 px-4">Risk</th>
                      <th className="py-2.5 px-4">Age</th>
                      <th className="py-2.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayPriority.map((claim) => {
                      const policyId = claim.policy?.policyNumber || claim.claimInfo?.policyId || 'POL-UNASSIGNED';
                      const customerName = claim.customer?.name || policyId;
                      const vehicle = `${claim.vehicle?.year || ''} ${claim.vehicle?.make || 'Vehicle'} ${claim.vehicle?.model || ''}`.trim();
                      const fraudScore = claim.aiAssessment?.scores?.fraud || claim.decision?.scores?.fraud || 0;
                      const age = calculateAge(claim.createdAt || claim.incident?.date);

                      return (
                        <tr
                          key={claim.claimId || claim.jobId}
                          onClick={() => navigate(`/claims/${claim.claimId || claim.jobId}`)}
                          className="hover:bg-slate-50 cursor-pointer transition"
                        >
                          <td className="py-3 px-4 font-mono font-medium text-slate-900">
                            {claim.claimId || (claim.jobId ? `CLM-${claim.jobId.slice(0, 6).toUpperCase()}` : 'CLM-UNASSIGNED')}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-medium text-slate-800 block">{customerName}</span>
                            <span className="text-[11px] text-slate-500 font-mono">{policyId}</span>
                          </td>
                          <td className="py-3 px-4 text-slate-600">{vehicle}</td>
                          <td className="py-3 px-4">{getStatusBadge(claim.status)}</td>
                          <td className="py-3 px-4">{getRiskIndicator(fraudScore)}</td>
                          <td className="py-3 px-4 text-slate-500">{age}</td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/claims/${claim.claimId || claim.jobId}`);
                              }}
                              className="text-xs font-medium text-blue-600 hover:text-blue-800"
                            >
                              Review
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

        <div className="space-y-6">
          <div className="bg-white rounded border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-1">Assessment Outcomes</h3>
            <p className="text-xs text-slate-500 mb-4">Distribution across current active intake.</p>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', fontSize: '11px', borderRadius: '4px' }}
                  />
                  <Bar dataKey="count" fill="#2563eb" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded border border-slate-200">
            <div className="px-4 py-3 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">Recent Activity</h3>
            </div>
            <div className="p-4 divide-y divide-slate-100 text-xs">
              {claims.length === 0 ? (
                <p className="text-slate-500 text-center py-4">No recent activity recorded.</p>
              ) : (
                claims.slice(0, 4).map((claim, idx) => (
                  <div key={idx} className="py-2.5 first:pt-0 last:pb-0">
                    <p className="font-medium text-slate-800">
                      Claim {claim.claimId || (claim.jobId ? `CLM-${claim.jobId.slice(0, 6).toUpperCase()}` : 'CLM-RECORD')} • {claim.status?.replace(/_/g, ' ')}
                    </p>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Policy: {claim.policy?.policyNumber || claim.claimInfo?.policyId || 'N/A'} • AI Rec: {claim.aiAssessment?.recommendation || 'Evaluated'}
                    </p>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {claim.createdAt ? new Date(claim.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClaimsDashboard;
