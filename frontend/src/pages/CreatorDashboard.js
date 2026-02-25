import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useAuth, api } from '../context/AuthContext';
import { CheckCircle, Clock, XCircle, AlertTriangle, Plus, FileText, Award, Copy, ExternalLink, TrendingUp, Key, Trash2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const statusConfig = {
  approved: { color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle, iconColor: 'text-emerald-500' },
  pending: { color: 'bg-amber-100 text-amber-700', icon: Clock, iconColor: 'text-amber-500' },
  rejected: { color: 'bg-rose-100 text-rose-700', icon: XCircle, iconColor: 'text-rose-500' },
  flagged: { color: 'bg-orange-100 text-orange-700', icon: AlertTriangle, iconColor: 'text-orange-500' },
  revision_requested: { color: 'bg-blue-100 text-blue-700', icon: Clock, iconColor: 'text-blue-500' },
};

function TrustGauge({ score }) {
  const color = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  const r = 40, circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const level = score >= 80 ? 'High Trust' : score >= 50 ? 'Medium Trust' : 'Low Trust';
  return (
    <div className="flex flex-col items-center">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          transform="rotate(-90 50 50)" style={{ transition: 'stroke-dashoffset 1s ease' }} />
        <text x="50" y="54" textAnchor="middle" fontSize="18" fontWeight="bold" fill="#1e293b">{score}</text>
      </svg>
      <span className="text-xs font-semibold mt-1" style={{ color }}>{level}</span>
    </div>
  );
}

function ScoreBar({ label, value, color }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs font-medium mb-1">
        <span className="text-slate-600">{label}</span>
        <span className="text-slate-800">{(value * 100).toFixed(0)}%</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full score-bar`} style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  );
}

export default function CreatorDashboard() {
  const { user, refreshUser } = useAuth();
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [form, setForm] = useState({ title: '', content_text: '', content_url: '' });
  const [apiKeys, setApiKeys] = useState([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [revealedKeys, setRevealedKeys] = useState({});

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, subsRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/submissions')
      ]);
      setStats(statsRes.data);
      setSubmissions(subsRes.data);
    } catch (e) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async e => {
    e.preventDefault();
    if (form.content_text.trim().length < 50) { toast.error('Content must be at least 50 characters'); return; }
    setSubmitting(true);
    setResult(null);
    try {
      const res = await api.post('/submissions', { ...form, content_url: form.content_url || null });
      setResult(res.data);
      setForm({ title: '', content_text: '', content_url: '' });
      toast.success('Submission created!');
      fetchData();
      refreshUser();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const approvedSubs = submissions.filter(s => s.status === 'approved' && s.verification_id);
  const tabs = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'submit', label: 'Submit Content', icon: Plus },
    { id: 'history', label: 'My Submissions', icon: FileText },
    { id: 'badge', label: 'Badge Generator', icon: Award },
  ];

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Welcome, {user?.name}</h1>
            <p className="text-slate-500 text-sm mt-0.5">Creator Dashboard</p>
          </div>
          {stats && <TrustGauge score={stats.trust_score} />}
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Submissions', value: stats.total, color: 'text-indigo-600', bg: 'bg-indigo-50' },
              { label: 'Approved', value: stats.approved, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Pending Review', value: stats.pending, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Rejected', value: stats.rejected, color: 'text-rose-600', bg: 'bg-rose-50' },
            ].map((s, i) => (
              <div key={i} className="bg-white rounded-xl p-5 border border-slate-100 card-hover" data-testid={`stat-${s.label.toLowerCase().replace(' ', '-')}`}>
                <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-slate-500 mt-1 font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex border-b border-slate-100 overflow-x-auto">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-5 py-4 text-sm font-medium whitespace-nowrap transition-colors ${tab === t.id ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:text-slate-700'}`}
                data-testid={`tab-${t.id}`}>
                <t.icon className="w-4 h-4" />{t.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* Overview Tab */}
            {tab === 'overview' && (
              <div className="space-y-6">
                <h3 className="font-semibold text-slate-800">Recent Activity</h3>
                {submissions.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No submissions yet. Start by submitting content!</p>
                    <button onClick={() => setTab('submit')} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors">Submit Content</button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {submissions.slice(0, 5).map(sub => {
                      const cfg = statusConfig[sub.status] || statusConfig.pending;
                      return (
                        <div key={sub.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="flex items-center gap-3 min-w-0">
                            <cfg.icon className={`w-5 h-5 flex-shrink-0 ${cfg.iconColor}`} />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-800 truncate">{sub.title}</p>
                              <p className="text-xs text-slate-400">{new Date(sub.created_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${cfg.color}`}>{sub.status}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Submit Tab */}
            {tab === 'submit' && (
              <div className="max-w-2xl">
                <h3 className="font-semibold text-slate-800 mb-4">Submit Content for Certification</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Content Title *</label>
                    <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required
                      placeholder="e.g., My Analysis of Climate Change" data-testid="submission-title"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Content URL (optional)</label>
                    <input value={form.content_url} onChange={e => setForm(f => ({ ...f, content_url: e.target.value }))}
                      placeholder="https://your-blog.com/article" data-testid="submission-url"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Content Text * (min 50 chars)</label>
                    <textarea value={form.content_text} onChange={e => setForm(f => ({ ...f, content_text: e.target.value }))} required
                      rows={8} placeholder="Paste your full article or text content here..." data-testid="submission-content"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all resize-none" />
                    <p className="text-xs text-slate-400 mt-1">{form.content_text.length} characters</p>
                  </div>
                  <button type="submit" disabled={submitting} data-testid="submit-content-button"
                    className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition-colors">
                    {submitting ? 'Analyzing...' : 'Submit for Certification'}
                  </button>
                </form>

                {result && (
                  <div className={`mt-6 p-6 rounded-2xl border-2 animate-fade-in-up ${result.status === 'approved' ? 'bg-emerald-50 border-emerald-200' : result.status === 'flagged' ? 'bg-orange-50 border-orange-200' : 'bg-amber-50 border-amber-200'}`} data-testid="submission-result">
                    <div className="flex items-center gap-3 mb-4">
                      {result.status === 'approved' ? <CheckCircle className="w-6 h-6 text-emerald-600" /> : <Clock className="w-6 h-6 text-amber-600" />}
                      <div>
                        <h4 className="font-bold text-slate-800">
                          {result.status === 'approved' ? 'Auto-Approved!' : result.status === 'flagged' ? 'Flagged for Review' : 'Queued for Manual Review'}
                        </h4>
                        {result.verification_id && <p className="text-sm text-emerald-600 font-mono font-medium">{result.verification_id}</p>}
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">AI Detection</p>
                        <ScoreBar label="Human Probability" value={result.ai_human_probability} color="bg-emerald-500" />
                        <ScoreBar label="AI Probability" value={result.ai_ai_probability} color="bg-rose-400" />
                        <p className="text-xs text-slate-500">Confidence: <span className="font-medium capitalize">{result.ai_confidence}</span></p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Stylometry</p>
                        <ScoreBar label="Style Score" value={result.stylometry_score} color="bg-indigo-500" />
                        <p className="text-xs text-slate-500">Words: {result.stylometry_features?.word_count}</p>
                        <p className="text-xs text-slate-500">Vocab Richness: {(result.stylometry_features?.vocabulary_richness * 100).toFixed(0)}%</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* History Tab */}
            {tab === 'history' && (
              <div>
                <h3 className="font-semibold text-slate-800 mb-4">Submission History ({submissions.length})</h3>
                {submissions.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">No submissions yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="submissions-table">
                      <thead>
                        <tr className="text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-100">
                          <th className="text-left py-3 pr-4">Title</th>
                          <th className="text-left py-3 pr-4">AI Score</th>
                          <th className="text-left py-3 pr-4">Status</th>
                          <th className="text-left py-3 pr-4">Date</th>
                          <th className="text-left py-3">Verification ID</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {submissions.map(sub => {
                          const cfg = statusConfig[sub.status] || statusConfig.pending;
                          return (
                            <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-3 pr-4 font-medium text-slate-800 max-w-[200px] truncate">{sub.title}</td>
                              <td className="py-3 pr-4">
                                <span className={`font-medium ${sub.ai_human_probability > 0.7 ? 'text-emerald-600' : sub.ai_human_probability > 0.5 ? 'text-amber-600' : 'text-rose-600'}`}>
                                  {(sub.ai_human_probability * 100).toFixed(0)}% human
                                </span>
                              </td>
                              <td className="py-3 pr-4">
                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${cfg.color}`}>{sub.status}</span>
                              </td>
                              <td className="py-3 pr-4 text-slate-500">{new Date(sub.created_at).toLocaleDateString()}</td>
                              <td className="py-3">
                                {sub.verification_id ? (
                                  <a href={`/verify/${sub.verification_id}`} target="_blank" rel="noopener noreferrer"
                                    className="text-indigo-600 font-mono text-xs hover:underline flex items-center gap-1">
                                    {sub.verification_id} <ExternalLink className="w-3 h-3" />
                                  </a>
                                ) : <span className="text-slate-300 text-xs">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Badge Generator Tab */}
            {tab === 'badge' && (
              <div>
                <h3 className="font-semibold text-slate-800 mb-4">Badge Generator</h3>
                {approvedSubs.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Award className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No approved submissions yet. Submit content to get certified!</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {approvedSubs.map(sub => {
                      const embedCode = `<a href="${BACKEND_URL}/verify/${sub.verification_id}" target="_blank" style="display:inline-flex;align-items:center;gap:8px;padding:8px 16px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:white;border-radius:24px;font-family:-apple-system,sans-serif;font-size:13px;font-weight:600;text-decoration:none;">\n  <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>\n  Verified Human Content\n</a>`;
                      return (
                        <div key={sub.id} className="border border-slate-200 rounded-2xl p-6 bg-slate-50">
                          <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                              <h4 className="font-semibold text-slate-800">{sub.title}</h4>
                              <p className="text-xs text-slate-500 font-mono mt-1">{sub.verification_id}</p>
                            </div>
                            <a href={`/verify/${sub.verification_id}`} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 text-xs text-slate-600 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap">
                              View Certificate <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>

                          {/* Badge Preview */}
                          <div className="flex items-center gap-3 mb-4 p-4 bg-white rounded-xl border border-slate-100">
                            <p className="text-xs text-slate-500 mr-2">Preview:</p>
                            <a href={`/verify/${sub.verification_id}`} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-white text-xs font-bold badge-shine">
                              <CheckCircle className="w-4 h-4" /> Verified Human Content
                            </a>
                          </div>

                          {/* Embed Code */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Embed Code</p>
                              <button onClick={() => { navigator.clipboard.writeText(embedCode); toast.success('Copied!'); }}
                                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800" data-testid="copy-embed-btn">
                                <Copy className="w-3.5 h-3.5" /> Copy
                              </button>
                            </div>
                            <pre className="bg-slate-900 text-emerald-400 text-xs rounded-xl p-4 overflow-x-auto font-mono leading-relaxed">{embedCode}</pre>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
