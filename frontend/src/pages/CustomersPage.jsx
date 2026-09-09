import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { claimAPI } from '../services/api';

const DEFAULT_CUSTOMERS = [
  { id: 'CUST-101', name: 'Robert Vance', policy: 'POL-4402', email: 'r.vance@example.com', phone: '+1 (555) 234-8901' },
  { id: 'CUST-102', name: 'Sarah Jenkins', policy: 'POL-8831', email: 's.jenkins@example.com', phone: '+1 (555) 345-9012' },
  { id: 'CUST-103', name: 'David Chen', policy: 'POL-1920', email: 'd.chen@example.com', phone: '+1 (555) 456-0123' },
  { id: 'CUST-104', name: 'Elena Rostova', policy: 'POL-3319', email: 'e.rostova@example.com', phone: '+1 (555) 567-1234' },
  { id: 'CUST-105', name: 'Marcus Bell', policy: 'POL-7722', email: 'm.bell@example.com', phone: '+1 (555) 678-2345' }
];

const CustomersPage = () => {
  const navigate = useNavigate();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);

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

  const customerMap = {};
  DEFAULT_CUSTOMERS.forEach((c) => {
    customerMap[c.policy] = {
      ...c,
      claims: [],
      openReviews: 0,
      maxRisk: 'Low',
      latestClaimDate: 'N/A'
    };
  });

  claims.forEach((claim) => {
    const policyId = claim.policy?.policyNumber || claim.claimInfo?.policyId || 'POL-UNASSIGNED';
    if (!customerMap[policyId]) {
      customerMap[policyId] = {
        id: claim.customer?.customerId || `CUST-${policyId.replace(/\D/g, '').slice(0, 4) || '999'}`,
        name: claim.customer?.name || `Policyholder ${policyId}`,
        policy: policyId,
        email: claim.customer?.email || `policyholder-${policyId.toLowerCase()}@client.org`,
        phone: claim.customer?.phone || '+1 (555) 000-0000',
        claims: [],
        openReviews: 0,
        maxRisk: 'Low',
        latestClaimDate: 'N/A'
      };
    }

    const c = customerMap[policyId];
    c.claims.push(claim);

    if (
      claim.status === 'PENDING_REVIEW' ||
      claim.status === 'UNDER_REVIEW' ||
      claim.status === 'REVIEW_REQUIRED' ||
      claim.decision?.recommendation === 'MANUAL_REVIEW'
    ) {
      c.openReviews += 1;
    }

    const fraud = claim.aiAssessment?.fraudAssessment?.overallScore ?? claim.decision?.scores?.fraud ?? 0;
    if (fraud >= 7 || claim.decision?.recommendation === 'REJECT') {
      c.maxRisk = 'High';
    } else if (fraud >= 4 && c.maxRisk !== 'High') {
      c.maxRisk = 'Medium';
    }

    const claimDate = claim.createdAt || claim.incident?.date || claim.claimInfo?.date;
    if (claimDate) {
      if (c.latestClaimDate === 'N/A' || new Date(claimDate) > new Date(c.latestClaimDate)) {
        c.latestClaimDate = new Date(claimDate).toLocaleDateString();
      }
    }
  });

  const customerList = Object.values(customerMap);

  const filteredCustomers = customerList.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.policy.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
  });

  const getRiskBadge = (risk) => {
    if (risk === 'High') {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-50 text-rose-800 border border-rose-200">High</span>;
    }
    if (risk === 'Medium') {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">Medium</span>;
    }
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">Low</span>;
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Customers</h1>
        <p className="text-sm text-slate-500 mt-1">Directory of insured policyholders and their claim histories.</p>
      </div>

      <div className="flex justify-between items-center">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search by name, policy, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400 text-slate-900"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">Loading customer records...</div>
        ) : filteredCustomers.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">No customers found matching search criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-medium">
                  <th className="py-2.5 px-4">Customer</th>
                  <th className="py-2.5 px-4">Policy</th>
                  <th className="py-2.5 px-4">Total Claims</th>
                  <th className="py-2.5 px-4">Open Reviews</th>
                  <th className="py-2.5 px-4">Risk Profile</th>
                  <th className="py-2.5 px-4">Latest Claim</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    onClick={() => setSelectedCustomer(customer)}
                    className="hover:bg-slate-50 cursor-pointer transition"
                  >
                    <td className="py-3 px-4 font-medium text-slate-900">
                      <div>{customer.name}</div>
                      <div className="text-[11px] text-slate-500">{customer.email}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">{customer.policy}</td>
                    <td className="py-3 px-4 text-slate-700">{customer.claims.length}</td>
                    <td className="py-3 px-4">
                      {customer.openReviews > 0 ? (
                        <span className="text-amber-700 font-medium">{customer.openReviews} pending</span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="py-3 px-4">{getRiskBadge(customer.maxRisk)}</td>
                    <td className="py-3 px-4 text-slate-600">{customer.latestClaimDate}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCustomer(customer);
                        }}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800"
                      >
                        Profile
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedCustomer && (
        <div className="fixed inset-0 bg-slate-900/40 flex justify-end z-50">
          <div className="bg-white w-full max-w-md h-full shadow-2xl p-6 overflow-y-auto space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{selectedCustomer.name}</h2>
                <span className="text-xs text-slate-500 font-mono">{selectedCustomer.id}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs bg-slate-50 p-4 rounded border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-500">Primary Policy:</span>
                <span className="font-mono font-medium text-slate-800">{selectedCustomer.policy}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Email:</span>
                <span className="text-slate-800">{selectedCustomer.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Phone:</span>
                <span className="text-slate-800">{selectedCustomer.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Risk Profile:</span>
                <span>{getRiskBadge(selectedCustomer.maxRisk)}</span>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-3">Claim History</h3>
              {selectedCustomer.claims.length === 0 ? (
                <div className="text-xs text-slate-500 py-6 text-center bg-slate-50 rounded border border-slate-200">
                  No filed claims under this profile.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedCustomer.claims.map((claim) => (
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
                          Score: {(claim.aiAssessment?.damageAssessment?.score ?? claim.decision?.scores?.damage ?? 0).toFixed(1)}/10
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

export default CustomersPage;
