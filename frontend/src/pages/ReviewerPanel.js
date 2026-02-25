import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { api } from '../context/AuthContext';
import { CheckCircle, XCircle, Clock, AlertTriangle, Eye, Shield, RefreshCw } from 'lucide-react';

const statusColors = {
  pending: 'bg-amber-100 text-amber-700',
  flagged: 'bg-orange-100 text-orange-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
};

const trustColors = {
  high: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-rose-100 text-rose-700 border-rose-200',
};

function ScoreBar({ value, label, colorClass }) {
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-500">{label}</span>
        <span className="font-semibold text-slate-700">{(value * 100).toFixed(1)}%</span>
      </div>
      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${colorClass} rounded-full transition-all duration-1000`} style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  );
}

function ReviewModal({ sub, onClose, onDecision }) {
  const [decision, setDecision] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!decision) { toast.error('Please select a decision'); return; }
    setSubmitting(true);
    try {
      await api.post(`/moderation/${sub.id}/review`, { decision, notes });
      toast.success(`Submission ${decision}`);
      onDecision();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Review failed');
    } finally {
      setSubmitting(false);
    }
  };

  const riskLevel = sub.ai_human_probability > 0.7 ? 'low' : sub.ai_human_probability > 0.5 ? 'medium' : 'high';
  const riskColor = { low: 'text-emerald-600', medium: 'text-amber-600', high: 'text-rose-600' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()} data-testid="review-modal">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="font-bold text-slate-900 text-lg">Review Submission</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Title + Creator */}
          <div>
            <h3 className="font-semibold text-slate-800 text-base">{sub.title}</h3>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-sm text-slate-500">By <strong className="text-slate-700">{sub.creator_name}</strong></span>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${trustColors[sub.creator_trust_level || 'medium']}`}>
                {(sub.creator_trust_level || 'medium').charAt(0).toUpperCase() + (sub.creator_trust_level || 'medium').slice(1)} Trust
              </span>
              <span className="text-xs text-slate-400">Score: {sub.creator_trust_score}</span>
            </div>
          </div>

          {/* Scores */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">AI Detection</p>
              <ScoreBar value={sub.ai_human_probability} label="Human Probability" colorClass="bg-emerald-500" />
              <ScoreBar value={sub.ai_ai_probability} label="AI Probability" colorClass="bg-rose-400" />
              <div className="mt-2 flex items-center gap-2">
                <span className={`text-sm font-bold ${riskColor[riskLevel]}`}>
                  {riskLevel.toUpperCase()} RISK
                </span>
                <span className="text-xs text-slate-400">Confidence: {sub.ai_confidence}</span>
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Stylometry</p>
              <ScoreBar value={sub.stylometry_score} label="Style Score" colorClass="bg-gray-500" />
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-xs"><span className="text-slate-500">Words</span><span className="font-medium text-slate-700">{sub.stylometry_features?.word_count}</span></div>
                <div className="flex justify-between text-xs"><span className="text-slate-500">Sentences</span><span className="font-medium text-slate-700">{sub.stylometry_features?.sentence_count}</span></div>
                <div className="flex justify-between text-xs"><span className="text-slate-500">Vocab Richness</span><span className="font-medium text-slate-700">{((sub.stylometry_features?.vocabulary_richness || 0) * 100).toFixed(0)}%</span></div>
                <div className="flex justify-between text-xs"><span className="text-slate-500">Avg Word Length</span><span className="font-medium text-slate-700">{sub.stylometry_features?.avg_word_length}</span></div>
              </div>
            </div>
          </div>

          {/* Content Preview */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Content Preview</p>
            <div className="bg-slate-50 rounded-xl p-4 max-h-40 overflow-y-auto">
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{sub.content_text}</p>
            </div>
          </div>

          {/* Decision */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Decision</p>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { value: 'approved', label: 'Approve', icon: CheckCircle, color: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
                { value: 'rejected', label: 'Reject', icon: XCircle, color: 'border-rose-300 bg-rose-50 text-rose-700' },
                { value: 'revision_requested', label: 'Request Revision', icon: Clock, color: 'border-amber-300 bg-amber-50 text-amber-700' },
              ].map(opt => (
                <button key={opt.value} onClick={() => setDecision(opt.value)}
                  className={`p-3 rounded-xl border-2 text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${decision === opt.value ? opt.color + ' shadow-sm' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}
                  data-testid={`decision-${opt.value}`}>
                  <opt.icon className="w-5 h-5" />{opt.label}
                </button>
              ))}
            </div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Add reviewer notes (optional)..." data-testid="review-notes"
              className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none" />
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
            <button onClick={handleSubmit} disabled={!decision || submitting}
              className="flex-1 py-3 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-black disabled:opacity-60 transition-colors"
              data-testid="submit-review-button">
              {submitting ? 'Submitting...' : 'Submit Decision'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReviewerPanel() {
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [qRes, sRes] = await Promise.all([api.get('/moderation/queue'), api.get('/moderation/stats')]);
      setQueue(qRes.data);
      setStats(sRes.data);
    } catch (e) {
      toast.error('Failed to load queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full" /></div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Shield className="w-7 h-7 text-gray-900" /> Review Panel
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">Moderation Queue</p>
          </div>
          <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm rounded-xl hover:bg-slate-50 transition-colors">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Pending Review', value: stats.pending, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Flagged', value: stats.flagged, color: 'text-orange-600', bg: 'bg-orange-50' },
              { label: 'Approved Total', value: stats.approved, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Rejected Total', value: stats.rejected, color: 'text-rose-600', bg: 'bg-rose-50' },
            ].map((s, i) => (
              <div key={i} className="bg-white rounded-xl p-5 border border-slate-100 card-hover">
                <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-slate-500 mt-1 font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Queue */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Moderation Queue ({queue.length})</h2>
            {queue.length > 0 && <span className="text-xs text-amber-600 font-medium bg-amber-50 px-2 py-1 rounded-full">{queue.length} pending</span>}
          </div>

          {queue.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-300" />
              <p className="font-medium">Queue is empty!</p>
              <p className="text-sm mt-1">All submissions have been reviewed.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="moderation-queue-table">
                <thead>
                  <tr className="text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-6 py-3">Title</th>
                    <th className="text-left px-4 py-3">Creator</th>
                    <th className="text-left px-4 py-3">Trust</th>
                    <th className="text-left px-4 py-3">AI Score</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Submitted</th>
                    <th className="text-left px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {queue.map(sub => (
                    <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-800 max-w-[180px] truncate">{sub.title}</td>
                      <td className="px-4 py-4 text-slate-600">{sub.creator_name}</td>
                      <td className="px-4 py-4">
                        <span className={`text-xs px-2 py-1 rounded-full border font-medium ${trustColors[sub.creator_trust_level || 'medium']}`}>
                          {sub.creator_trust_score}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${sub.ai_human_probability > 0.7 ? 'bg-emerald-500' : sub.ai_human_probability > 0.5 ? 'bg-amber-500' : 'bg-rose-500'}`}
                              style={{ width: `${sub.ai_human_probability * 100}%` }} />
                          </div>
                          <span className="text-xs font-medium text-slate-600">{(sub.ai_human_probability * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[sub.status]}`}>{sub.status}</span>
                      </td>
                      <td className="px-4 py-4 text-slate-500 text-xs">{new Date(sub.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-4">
                        <button onClick={() => setSelected(sub)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-black transition-colors"
                          data-testid={`review-btn-${sub.id}`}>
                          <Eye className="w-3.5 h-3.5" /> Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selected && (
        <ReviewModal sub={selected} onClose={() => setSelected(null)} onDecision={fetchData} />
      )}
    </div>
  );
}
