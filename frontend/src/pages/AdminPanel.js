import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { api } from '../context/AuthContext';
import { Users, Shield, AlertTriangle, Ban, CheckCircle, Settings, TrendingUp, Key, RefreshCw, Award, FileText } from 'lucide-react';

const statusColors = {
  active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  suspended: 'bg-amber-100 text-amber-700 border-amber-200',
  banned: 'bg-rose-100 text-rose-700 border-rose-200',
};

const trustColors = {
  high: 'text-emerald-600',
  medium: 'text-amber-600',
  low: 'text-rose-600',
};

function TrustEditor({ user, onUpdate }) {
  const [score, setScore] = useState(user.trust_score);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/admin/users/${user.id}/trust`, { trust_score: parseInt(score) });
      toast.success('Trust score updated');
      onUpdate();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update trust score');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input type="number" min={0} max={100} value={score}
        onChange={e => setScore(e.target.value)}
        className="w-16 px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-300"
        data-testid={`trust-input-${user.id}`} />
      <button onClick={save} disabled={saving}
        className="px-2 py-1 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
        {saving ? '...' : 'Set'}
      </button>
    </div>
  );
}

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users');
  const [updatingStatus, setUpdatingStatus] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, sRes] = await Promise.all([api.get('/admin/users'), api.get('/admin/stats')]);
      setUsers(uRes.data);
      setStats(sRes.data);
    } catch (e) {
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateStatus = async (uid, status) => {
    setUpdatingStatus(uid);
    try {
      await api.post(`/admin/users/${uid}/status`, { status });
      toast.success(`User ${status}`);
      fetchData();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update status');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const tabs = [
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'overview', label: 'System Overview', icon: TrendingUp },
  ];

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Settings className="w-7 h-7 text-indigo-600" /> Admin Panel
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">System administration and user management</p>
          </div>
          <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm rounded-xl hover:bg-slate-50 transition-colors">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* Stats Row */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            {[
              { label: 'Total Users', value: stats.total_users, color: 'text-indigo-600', icon: Users },
              { label: 'Certificates', value: stats.total_certificates, color: 'text-emerald-600', icon: Award },
              { label: 'Pending Review', value: stats.pending_review, color: 'text-amber-600', icon: FileText },
              { label: 'Suspended/Banned', value: (stats.suspended || 0) + (stats.banned || 0), color: 'text-rose-600', icon: Ban },
              { label: 'Active API Keys', value: stats.api_keys_active, color: 'text-violet-600', icon: Key },
            ].map((s, i) => (
              <div key={i} className="bg-white rounded-xl p-4 border border-slate-100 card-hover">
                <div className="flex items-center gap-2 mb-1">
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                  <span className="text-xs text-slate-500 font-medium">{s.label}</span>
                </div>
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex border-b border-slate-100">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === t.id ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:text-slate-700'}`}
                data-testid={`admin-tab-${t.id}`}>
                <t.icon className="w-4 h-4" />{t.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* Users Tab */}
            {activeTab === 'users' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-800">All Users ({users.length})</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="admin-users-table">
                    <thead>
                      <tr className="text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-100 bg-slate-50">
                        <th className="text-left px-4 py-3">User</th>
                        <th className="text-left px-4 py-3">Role</th>
                        <th className="text-left px-4 py-3">Status</th>
                        <th className="text-left px-4 py-3">Trust Score</th>
                        <th className="text-left px-4 py-3">Set Trust</th>
                        <th className="text-left px-4 py-3">Joined</th>
                        <th className="text-left px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {users.map(u => (
                        <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-sm flex-shrink-0">
                                {u.name?.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-slate-800">{u.name}</p>
                                <p className="text-xs text-slate-400">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full font-medium capitalize">{u.role}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-1 rounded-full border font-medium ${statusColors[u.status] || statusColors.active}`}>
                              {u.status || 'active'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${u.trust_score >= 80 ? 'bg-emerald-500' : u.trust_score >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                  style={{ width: `${u.trust_score}%` }} />
                              </div>
                              <span className={`text-xs font-bold ${trustColors[u.trust_level]}`}>{u.trust_score}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <TrustEditor user={u} onUpdate={fetchData} />
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                            {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              {u.status !== 'active' && (
                                <button onClick={() => updateStatus(u.id, 'active')}
                                  disabled={updatingStatus === u.id}
                                  className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors text-xs font-medium"
                                  title="Activate" data-testid={`activate-${u.id}`}>
                                  <CheckCircle className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {u.status !== 'suspended' && (
                                <button onClick={() => updateStatus(u.id, 'suspended')}
                                  disabled={updatingStatus === u.id}
                                  className="p-1.5 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors text-xs font-medium"
                                  title="Suspend" data-testid={`suspend-${u.id}`}>
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {u.status !== 'banned' && (
                                <button onClick={() => {
                                  if (window.confirm(`Ban ${u.name}? This will prevent them from logging in.`)) {
                                    updateStatus(u.id, 'banned');
                                  }
                                }}
                                  disabled={updatingStatus === u.id}
                                  className="p-1.5 bg-rose-50 text-rose-700 rounded-lg hover:bg-rose-100 transition-colors text-xs font-medium"
                                  title="Ban" data-testid={`ban-${u.id}`}>
                                  <Ban className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Overview Tab */}
            {activeTab === 'overview' && stats && (
              <div className="space-y-6">
                <h3 className="font-semibold text-slate-800">System Overview</h3>
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="bg-slate-50 rounded-xl p-5">
                    <h4 className="font-medium text-slate-700 mb-4 text-sm">User Breakdown</h4>
                    <div className="space-y-3">
                      {[
                        { label: 'Creators', value: stats.creators, color: 'bg-indigo-500' },
                        { label: 'Reviewers', value: stats.reviewers, color: 'bg-violet-500' },
                        { label: 'Suspended', value: stats.suspended, color: 'bg-amber-500' },
                        { label: 'Banned', value: stats.banned, color: 'bg-rose-500' },
                      ].map((s, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-xs text-slate-500 w-20">{s.label}</span>
                          <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div className={`h-full ${s.color} rounded-full`}
                              style={{ width: `${stats.total_users > 0 ? (s.value / stats.total_users) * 100 : 0}%` }} />
                          </div>
                          <span className="text-xs font-bold text-slate-700 w-6 text-right">{s.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-5">
                    <h4 className="font-medium text-slate-700 mb-4 text-sm">Platform Health</h4>
                    <div className="space-y-2">
                      {[
                        { label: 'Total Submissions', value: stats.total_submissions },
                        { label: 'Active Certificates', value: stats.total_certificates },
                        { label: 'Pending Review', value: stats.pending_review },
                        { label: 'Active API Keys', value: stats.api_keys_active },
                      ].map((s, i) => (
                        <div key={i} className="flex justify-between items-center py-1.5 border-b border-slate-200 last:border-0">
                          <span className="text-sm text-slate-500">{s.label}</span>
                          <span className="text-sm font-bold text-slate-800">{s.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
