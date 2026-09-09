import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { claimAPI } from '../services/api';

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#64748b'];

const ReportsPage = () => {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const totalClaims = claims.length;

  const reviewedClaims = claims.filter(c => 
    c.humanAssessment?.action || 
    c.assessorDecision || 
    c.decision?.outcome === 'APPROVED' || 
    c.decision?.outcome === 'REJECTED'
  );

  let agreementMetric = 'No data';
  if (reviewedClaims.length > 0) {
    const matches = reviewedClaims.filter(c => {
      const humanAction = c.humanAssessment?.action || c.assessorDecision?.newRecommendation || c.decision?.outcome || '';
      const aiRec = c.aiAssessment?.recommendation || c.decision?.recommendation || '';
      return humanAction && aiRec && (
        humanAction.toUpperCase().startsWith(aiRec.toUpperCase().slice(0, 5)) ||
        aiRec.toUpperCase().startsWith(humanAction.toUpperCase().slice(0, 5))
      );
    }).length;
    agreementMetric = `${Math.round((matches / reviewedClaims.length) * 100)}% (${reviewedClaims.length} reviewed)`;
  }

  let avgDamageScore = 'N/A';
  if (totalClaims > 0) {
    const scoredClaims = claims.filter(c => (c.aiAssessment?.scores?.damage !== undefined || c.decision?.scores?.damage !== undefined));
    if (scoredClaims.length > 0) {
      const sum = scoredClaims.reduce((acc, c) => acc + (c.aiAssessment?.scores?.damage ?? c.decision?.scores?.damage ?? 0), 0);
      avgDamageScore = `${(sum / scoredClaims.length).toFixed(1)} / 10`;
    }
  }

  const reviewWorkloadCount = claims.filter(c =>
    (c.aiAssessment?.recommendation || c.decision?.recommendation) === 'MANUAL_REVIEW' || 
    c.status === 'UNDER_REVIEW' || 
    c.status === 'PENDING_REVIEW'
  ).length;

  const outcomeCounts = [
    { 
      name: 'Approved', 
      value: claims.filter(c => 
        c.decision?.outcome === 'APPROVED' || 
        c.humanAssessment?.action === 'APPROVED' || 
        (c.aiAssessment?.recommendation || c.decision?.recommendation) === 'APPROVE'
      ).length 
    },
    { name: 'Review Required', value: reviewWorkloadCount },
    { 
      name: 'Rejected', 
      value: claims.filter(c => 
        c.decision?.outcome === 'REJECTED' || 
        c.humanAssessment?.action === 'REJECTED' || 
        (c.aiAssessment?.recommendation || c.decision?.recommendation) === 'REJECT'
      ).length 
    },
    { name: 'Processing', value: claims.filter(c => c.status === 'PROCESSING' || c.status === 'SUBMITTED').length }
  ];

  const riskCounts = [
    { name: 'Low (0-3)', count: claims.filter(c => (c.aiAssessment?.scores?.fraud ?? c.decision?.scores?.fraud ?? 0) < 4).length },
    { name: 'Medium (4-6)', count: claims.filter(c => {
      const f = c.aiAssessment?.scores?.fraud ?? c.decision?.scores?.fraud ?? 0;
      return f >= 4 && f < 7;
    }).length },
    { name: 'High (7-10)', count: claims.filter(c => (c.aiAssessment?.scores?.fraud ?? c.decision?.scores?.fraud ?? 0) >= 7).length }
  ];

  return (
    <div className="space-y-6">

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded border border-slate-200">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Claims Volume</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{totalClaims}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Total recorded submissions</div>
        </div>

        <div className="bg-white p-4 rounded border border-slate-200">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Review Workload</div>
          <div className="mt-2 text-2xl font-bold text-amber-700">{reviewWorkloadCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Awaiting assessor determination</div>
        </div>

        <div className="bg-white p-4 rounded border border-slate-200">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Mean Damage Severity</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{avgDamageScore}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Across analyzed intake</div>
        </div>

        <div className="bg-white p-4 rounded border border-slate-200">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Assessor Agreement</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{agreementMetric}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Observable human audits</div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded p-12 text-center text-xs text-slate-500">
          Loading reporting metrics...
        </div>
      ) : totalClaims === 0 ? (
        <div className="bg-white border border-slate-200 rounded p-12 text-center text-xs text-slate-500">
          No data available for this period.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded border border-slate-200 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Claim Outcomes</h2>
            <p className="text-xs text-slate-500">Breakdown of recommendations and adjudications.</p>
            <div className="h-56 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={outcomeCounts.filter(o => o.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {outcomeCounts.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', fontSize: '11px', borderRadius: '4px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-4 text-xs pt-2">
              {outcomeCounts.map((item, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx] }}></span>
                  <span className="text-slate-600">{item.name}:</span>
                  <span className="font-semibold text-slate-900">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded border border-slate-200 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Risk Score Distribution</h2>
            <p className="text-xs text-slate-500">Claims grouped by combined fraud and anomaly scores.</p>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={riskCounts} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
