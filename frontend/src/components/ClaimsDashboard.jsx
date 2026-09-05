import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Clock, Search } from 'lucide-react';
import { claimAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';

const ClaimsDashboard = () => {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const loadClaims = async () => {
      try {
        setLoading(true);
        const params = filter !== 'all' ? { recommendation: filter } : {};
        const response = await claimAPI.getClaims(params);
        setClaims(response.claims);
      } catch (error) {
        console.error('Error fetching claims:', error);
      } finally {
        setLoading(false);
      }
    };
    loadClaims();
  }, [filter]);

  const getStatusColor = (recommendation) => {
    switch (recommendation) {
      case 'APPROVE':
        return 'bg-green-100 text-green-800';
      case 'REJECT':
        return 'bg-red-100 text-red-800';
      case 'MANUAL_REVIEW':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (recommendation) => {
    switch (recommendation) {
      case 'APPROVE':
        return <CheckCircle size={16} />;
      case 'REJECT':
        return <AlertCircle size={16} />;
      case 'MANUAL_REVIEW':
        return <Clock size={16} />;
      default:
        return null;
    }
  };

  const getRiskBadge = (score) => {
    if (score <= 3) {
      return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">Low Risk</span>;
    } else if (score <= 7) {
      return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">Medium Risk</span>;
    } else {
      return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">High Risk</span>;
    }
  };

  const filteredClaims = claims.filter(claim =>
    claim.claimInfo.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    claim.claimInfo.policyId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Claims Dashboard</h1>
        <p className="text-gray-600">Review and manage insurance claims</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search by description or policy ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'all' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('APPROVE')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'APPROVE' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Approved
            </button>
            <button
              onClick={() => setFilter('MANUAL_REVIEW')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'MANUAL_REVIEW' 
                  ? 'bg-yellow-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Review
            </button>
            <button
              onClick={() => setFilter('REJECT')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === 'REJECT' 
                  ? 'bg-red-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Rejected
            </button>
          </div>
        </div>
      </div>

      {/* Claims List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading claims...</p>
        </div>
      ) : filteredClaims.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <p className="text-gray-500">No claims found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredClaims.map((claim) => (
            <div
              key={claim.jobId}
              onClick={() => navigate(`/claim/${claim.jobId}`)}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {claim.claimInfo.policyId || 'No Policy ID'}
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 ${getStatusColor(claim.decision.recommendation)}`}>
                      {getStatusIcon(claim.decision.recommendation)}
                      {claim.decision.recommendation.replace('_', ' ')}
                    </span>
                  </div>

                  <p className="text-gray-600 mb-3 line-clamp-2">
                    {claim.claimInfo.description}
                  </p>

                  <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                    <span>📅 {new Date(claim.claimInfo.date).toLocaleDateString()}</span>
                    <span>📍 {claim.claimInfo.location}</span>
                    <span>🆔 {claim.jobId.slice(0, 8)}...</span>
                    {claim.claimType === 'VIDEO_WALK_AROUND' ? (
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full border border-indigo-200">
                        🎥 Video Walk-Around ({claim.keyframeSelection?.total_selected || claim.videoMetadata?.keyframe_count || 'Multi'}-Frame)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                        📷 Photo Claim
                      </span>
                    )}
                  </div>
                </div>

                <div className="ml-4 text-right space-y-2">
                  <div className="text-sm">
                    <div className="text-gray-500">Damage Score</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {claim.decision.scores.damage.toFixed(1)}
                      <span className="text-sm text-gray-500">/10</span>
                    </div>
                  </div>
                  <div>
                    {getRiskBadge(claim.decision.scores.fraud)}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Fraud Risk:</span>
                    <span className="ml-2 font-semibold">{claim.decision.scores.fraud.toFixed(1)}/10</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Consistency:</span>
                    <span className="ml-2 font-semibold">{claim.decision.scores.consistency.toFixed(1)}/10</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Severity:</span>
                    <span className="ml-2 font-semibold">{claim.analysis.damageAssessment.severity}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClaimsDashboard;
