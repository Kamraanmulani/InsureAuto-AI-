import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Search, Bell, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const Navbar = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/claims?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

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
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <NavLink to="/dashboard" className="flex items-center gap-2 text-slate-950 font-bold text-lg tracking-tight hover:opacity-90">
              <span className="w-8 h-8 rounded bg-slate-900 text-white flex items-center justify-center font-bold text-sm tracking-wider">
                IA
              </span>
              <span>InsureAuto AI</span>
            </NavLink>

            <nav className="hidden md:flex items-center gap-1">
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  `px-3 py-2 rounded text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-slate-900 bg-slate-100 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`
                }
              >
                Overview
              </NavLink>

              <NavLink
                to="/claims"
                className={({ isActive }) =>
                  `px-3 py-2 rounded text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-slate-900 bg-slate-100 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`
                }
              >
                Claims
              </NavLink>

              <NavLink
                to="/customers"
                className={({ isActive }) =>
                  `px-3 py-2 rounded text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-slate-900 bg-slate-100 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`
                }
              >
                Customers
              </NavLink>

              <NavLink
                to="/policies"
                className={({ isActive }) =>
                  `px-3 py-2 rounded text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-slate-900 bg-slate-100 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`
                }
              >
                Policies
              </NavLink>

              <NavLink
                to="/reports"
                className={({ isActive }) =>
                  `px-3 py-2 rounded text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-slate-900 bg-slate-100 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`
                }
              >
                Reports
              </NavLink>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <form onSubmit={handleSearchSubmit} className="relative hidden sm:block w-64">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search claims, policy, VIN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 text-slate-900"
              />
            </form>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setShowProfileMenu(false);
                }}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded relative"
                aria-label="Notifications"
              >
                <Bell size={18} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-600 rounded-full"></span>
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg border border-slate-200 py-2 z-50 text-xs">
                  <div className="px-3 py-2 border-b border-slate-100 font-semibold text-slate-800 flex justify-between items-center">
                    <span>Notifications</span>
                    <span className="text-[11px] text-slate-500 font-normal">2 unread</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    <div className="px-3 py-2.5 hover:bg-slate-50 cursor-pointer">
                      <p className="font-medium text-slate-800">High Risk Claim Flagged</p>
                      <p className="text-slate-500 text-[11px] mt-0.5">Policy POL-4402 has metadata tampering detected.</p>
                      <span className="text-[10px] text-slate-400 mt-1 block">12m ago</span>
                    </div>
                    <div className="px-3 py-2.5 hover:bg-slate-50 cursor-pointer">
                      <p className="font-medium text-slate-800">Review Required</p>
                      <p className="text-slate-500 text-[11px] mt-0.5">Video walk-around analysis ready for CLM-9021.</p>
                      <span className="text-[10px] text-slate-400 mt-1 block">1h ago</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowProfileMenu(!showProfileMenu);
                  setShowNotifications(false);
                }}
                className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-100 text-left"
              >
                <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-semibold">
                  {getInitials(user?.name)}
                </div>
                <div className="hidden lg:block leading-tight">
                  <span className="text-xs font-semibold text-slate-900 block">{user?.name || 'Assessor'}</span>
                  <span className="text-[11px] text-slate-500 block">{user?.role || 'ASSESSOR'}</span>
                </div>
              </button>

              {showProfileMenu && (
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
                      navigate('/settings');
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 flex items-center gap-2"
                  >
                    <Settings size={14} />
                    Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      handleLogout();
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 text-rose-600 flex items-center gap-2 border-t border-slate-100"
                  >
                    <LogOut size={14} />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
