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
    c.decision?.recommendation === 'MANUAL_REVIEW' || c.status === 'REVIEW_REQUIRED'
  ).length;

  const highRiskCount = claims.filter(c =>
    (c.decision?.scores?.fraud >= 7) || (c.decision?.recommendation === 'REJECT')
  ).length;

  const processingCount = claims.filter(c =>
    c.status === 'PROCESSING' || c.status === 'SUBMITTED'
  ).length;

  const completedCount = claims.filter(c =>
    c.status === 'APPROVED' || c.status === 'REJECTED' || c.status === 'CLOSED'
  ).length;

  const priorityClaims = claims.filter(c =>
    c.decision?.recommendation === 'MANUAL_REVIEW' || (c.decision?.scores?.fraud >= 6) || c.status === 'REVIEW_REQUIRED'
  ).slice(0, 6);

  const displayPriority = priorityClaims.length > 0 ? priorityClaims : claims.slice(0, 6);

  const chartData = [
    { name: 'Approve', count: claims.filter(c => c.decision?.recommendation === 'APPROVE').length },
    { name: 'Review', count: claims.filter(c => c.decision?.recommendation === 'MANUAL_REVIEW').length },
    { name: 'Reject', count: claims.filter(c => c.decision?.recommendation === 'REJECT').length },
    { name: 'Pending', count: processingCount }
  ];

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

  const getRiskIndicator = (score) => {
    const s = Number(score) || 0;
    if (s >= 7) {
      return <span className="text-xs font-semibold text-rose-700">High ({s.toFixed(1)})</span>;
    }
    if (s >= 4) {
      return <span className="text-xs font-semibold text-amber-700">Medium ({s.toFixed(1)})</span>;
    }
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
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4">Risk</th>
                      <th className="py-2.5 px-4">Age</th>
                      <th className="py-2.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayPriority.map((claim) => {
                      const policyId = claim.claimInfo?.policyId || 'POL-UNASSIGNED';
                      const desc = claim.claimInfo?.description || 'Motor accident';
                      const vehicle = claim.metadata?.vehicleInfo || (claim.claimType === 'VIDEO_WALK_AROUND' ? 'Video Walk-Around' : 'Standard Sedan');
                      const fraudScore = claim.decision?.scores?.fraud || 0;
                      const age = calculateAge(claim.createdAt || claim.claimInfo?.date);

                      return (
                        <tr
                          key={claim.jobId}
                          onClick={() => navigate(`/claims/${claim.jobId}`)}
                          className="hover:bg-slate-50 cursor-pointer transition"
                        >
                          <td className="py-3 px-4 font-mono font-medium text-slate-900">
                            CLM-{claim.jobId.slice(0, 6).toUpperCase()}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-medium text-slate-800 block">{policyId}</span>
                            <span className="text-[11px] text-slate-500 truncate max-w-[140px] block">{desc}</span>
                          </td>
                          <td className="py-3 px-4 text-slate-600">{vehicle}</td>
                          <td className="py-3 px-4">{getStatusBadge(claim)}</td>
                          <td className="py-3 px-4">{getRiskIndicator(fraudScore)}</td>
                          <td className="py-3 px-4 text-slate-500">{age}</td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/claims/${claim.jobId}`);
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
                      Claim CLM-{claim.jobId.slice(0, 6).toUpperCase()} assessed
                    </p>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Recommendation: {claim.decision?.recommendation || 'Evaluated'} • Policy: {claim.claimInfo?.policyId || 'N/A'}
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
