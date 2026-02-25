import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ChevronDown, LogOut, LayoutDashboard, ClipboardList, Globe, Menu, X, Settings } from 'lucide-react';

const trustColors = { high: 'bg-emerald-100 text-emerald-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-rose-100 text-rose-700' };

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/'); setDropdownOpen(false); };
  const isActive = (path) => location.pathname === path;

  const navLink = (to, label) => (
    <Link
      to={to}
      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive(to) ? 'bg-gray-50 text-gray-900' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
    >
      {label}
    </Link>
  );

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl text-slate-900">
            <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span>TrustInk</span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navLink('/', 'Home')}
            {navLink('/registry', 'Public Registry')}
            {user && user.role !== 'reviewer' && navLink('/dashboard', 'Dashboard')}
            {user && user.role !== 'creator' && navLink('/review', 'Review Panel')}
            {user && user.role === 'admin' && navLink('/admin', 'Admin')}
          </div>

          <div className="hidden md:flex items-center gap-3">
            {!user ? (
              <>
                <Link to="/auth" className="text-sm font-medium text-slate-600 hover:text-slate-900">Sign In</Link>
                <Link to="/auth" className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-black transition-colors">Get Started</Link>
              </>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
                  data-testid="user-menu-button"
                >
                  <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center text-white text-sm font-bold">
                    {user.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-slate-800">{user.name}</div>
                    <div className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${trustColors[user.trust_level || 'medium']}`}>
                      {(user.trust_level || 'medium').charAt(0).toUpperCase() + (user.trust_level || 'medium').slice(1)} Trust
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50 animate-fade-in">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="text-xs text-slate-500">Signed in as</p>
                      <p className="text-sm font-medium text-slate-800 truncate">{user.email}</p>
                      <p className="text-xs text-gray-900 capitalize font-medium">{user.role}</p>
                    </div>
                    {user.role === 'admin' && (
                      <button onClick={() => { navigate('/admin'); setDropdownOpen(false); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                        <Settings className="w-4 h-4" /> Admin Panel
                      </button>
                    )}
                    {user.role !== 'reviewer' && (
                      <button onClick={() => { navigate('/dashboard'); setDropdownOpen(false); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                        <LayoutDashboard className="w-4 h-4" /> Dashboard
                      </button>
                    )}
                    {user.role !== 'creator' && (
                      <button onClick={() => { navigate('/review'); setDropdownOpen(false); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                        <ClipboardList className="w-4 h-4" /> Review Panel
                      </button>
                    )}
                    <button onClick={() => { navigate('/registry'); setDropdownOpen(false); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                      <Globe className="w-4 h-4" /> Public Registry
                    </button>
                    <div className="border-t border-slate-100 mt-1" />
                    <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 transition-colors" data-testid="logout-button">
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <button className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden py-3 border-t border-slate-100 space-y-1">
            <Link to="/" className="block px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg" onClick={() => setMenuOpen(false)}>Home</Link>
            <Link to="/registry" className="block px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg" onClick={() => setMenuOpen(false)}>Public Registry</Link>
            {user?.role !== 'reviewer' && <Link to="/dashboard" className="block px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg" onClick={() => setMenuOpen(false)}>Dashboard</Link>}
            {user?.role !== 'creator' && <Link to="/review" className="block px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg" onClick={() => setMenuOpen(false)}>Review Panel</Link>}
            {!user && <Link to="/auth" className="block px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 rounded-lg" onClick={() => setMenuOpen(false)}>Sign In / Register</Link>}
            {user && <button onClick={handleLogout} className="w-full text-left px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 rounded-lg">Sign Out</button>}
          </div>
        )}
      </div>
    </nav>
  );
}
