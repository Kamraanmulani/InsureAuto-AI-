import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const from = location.state?.from?.pathname || '/dashboard';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter both email and password.');
      return;
    }

    try {
      setSubmitting(true);
      const user = await login(email, password);
      toast.success(`Welcome back, ${user.name}`);
      navigate(from, { replace: true });
    } catch (err) {
      const msg = err.response?.data?.error || 'Invalid credentials or connection error.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickFill = (role) => {
    if (role === 'ASSESSOR') {
      setEmail('assessor@claimsight.internal');
      setPassword('Password@123');
    } else if (role === 'ADMIN') {
      setEmail('admin@claimsight.internal');
      setPassword('AdminPassword@123');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded bg-slate-900 text-white font-bold text-base tracking-wider mb-3">
          CS
        </div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          ClaimSight Workspace
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Sign in to access the motor insurance claims assessment queue.
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 border border-slate-200 rounded sm:px-10 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="assessor@claimsight.internal"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400 text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400 text-slate-900"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none transition disabled:opacity-50"
              >
                {submitting ? 'Authenticating...' : 'Sign In'}
              </button>
            </div>
          </form>

          <div className="pt-4 border-t border-slate-100">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2 text-center">
              Quick Sign In (Test Credentials)
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill('ASSESSOR')}
                className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs rounded border border-slate-200 transition text-center"
              >
                Assessor Demo
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('ADMIN')}
                className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs rounded border border-slate-200 transition text-center"
              >
                Admin Demo
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
