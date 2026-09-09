import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const Navbar = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative flex items-center justify-between h-16">
          <NavLink to="/dashboard" className="flex items-center gap-2 text-slate-950 font-bold text-lg tracking-tight hover:opacity-90">
            <span className="w-8 h-8 rounded bg-slate-900 text-white flex items-center justify-center font-bold text-sm tracking-wider">
              IA
            </span>
            <span>InsureAuto AI</span>
          </NavLink>

          <nav className="hidden md:flex items-center gap-6 h-16 absolute left-1/2 -translate-x-1/2">
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `h-16 flex items-center px-1 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-black text-slate-900 font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`
              }
            >
              Overview
            </NavLink>

            <NavLink
              to="/claims"
              className={({ isActive }) =>
                `h-16 flex items-center px-1 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-black text-slate-900 font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`
              }
            >
              Claims
            </NavLink>

            <NavLink
              to="/customers"
              className={({ isActive }) =>
                `h-16 flex items-center px-1 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-black text-slate-900 font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`
              }
            >
              Customers
            </NavLink>

            <NavLink
              to="/policies"
              className={({ isActive }) =>
                `h-16 flex items-center px-1 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-black text-slate-900 font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`
              }
            >
              Policies
            </NavLink>

            <NavLink
              to="/reports"
              className={({ isActive }) =>
                `h-16 flex items-center px-1 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-black text-slate-900 font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`
              }
            >
              Reports
            </NavLink>
          </nav>

          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-semibold hover:bg-slate-800 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900"
                title={user?.name || 'Assessor'}
                aria-label="User menu"
              >
                {getInitials(user?.name)}
              </button>

              {showProfileMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowProfileMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-52 bg-white rounded-md shadow-lg border border-slate-200 py-1 z-50 text-xs">
                    <div className="px-3 py-2 border-b border-slate-100">
                      <p className="font-semibold text-slate-800">{user?.name || 'Assessor'}</p>
                      <p className="text-slate-500 text-[11px] truncate">{user?.email || 'authenticated'}</p>
                      <span className="inline-block mt-1 px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-medium text-slate-600">
                        Role: {user?.role || 'ASSESSOR'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        handleLogout();
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 text-rose-600 flex items-center gap-2"
                    >
                      <LogOut size={14} />
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
