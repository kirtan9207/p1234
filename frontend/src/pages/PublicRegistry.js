import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../context/AuthContext';
import { Search, CheckCircle, Award, Globe, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';

export default function PublicRegistry() {
  const [certs, setCerts] = useState([]);
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchCerts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 12 });
      if (query) params.append('search', query);
      const res = await api.get(`/registry?${params}`);
      setCerts(res.data.certificates);
      setTotal(res.data.total);
      setTotalPages(res.data.pages);
    } catch (e) {
      setCerts([]);
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => {
    api.get('/registry/stats').then(r => setStats(r.data)).catch(() => {});
  }, []);

  useEffect(() => { fetchCerts(); }, [fetchCerts]);

  const handleSearch = e => {
    e.preventDefault();
    setQuery(search);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
              <Globe className="w-5 h-5 text-gray-900" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Public Verification Registry</h1>
              <p className="text-slate-500 text-sm">Browse all verified human-created content</p>
            </div>
          </div>

          {stats && (
            <div className="flex flex-wrap gap-6 mt-4 text-sm">
              {[
                { label: 'Active Certificates', value: stats.total_certificates, color: 'text-emerald-600' },
                { label: 'Registered Creators', value: stats.total_creators, color: 'text-gray-900' },
                { label: 'Total Submissions', value: stats.total_submissions, color: 'text-gray-700' },
                { label: 'Revoked', value: stats.revoked, color: 'text-rose-500' },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className={`font-bold text-lg ${s.color}`}>{s.value}</span>
                  <span className="text-slate-500">{s.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-3 mt-6">
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by title or creator name..." data-testid="registry-search"
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all" />
            </div>
            <button type="submit" className="px-5 py-3 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-black transition-colors" data-testid="search-button">
              Search
            </button>
            {query && (
              <button type="button" onClick={() => { setQuery(''); setSearch(''); setPage(1); }}
                className="px-4 py-3 border border-slate-200 text-slate-600 text-sm rounded-xl hover:bg-slate-50 transition-colors">
                Clear
              </button>
            )}
          </form>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="animate-spin w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full" />
          </div>
        ) : certs.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Award className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">{query ? 'No results found' : 'No certificates yet'}</p>
            <p className="text-sm mt-1">{query ? 'Try a different search term' : 'Be the first to certify content!'}</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-500 mb-6">{total} certificate{total !== 1 ? 's' : ''} found{query ? ` for "${query}"` : ''}</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="registry-grid">
              {certs.map(cert => (
                <div key={cert.id} className="bg-white rounded-2xl border border-slate-100 p-5 card-hover" data-testid="registry-card">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                    </div>
                    <span className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full font-medium border border-emerald-100">Verified</span>
                  </div>
                  <h3 className="font-semibold text-slate-800 text-sm mb-1 leading-tight">{cert.content_title}</h3>
                  <p className="text-xs text-slate-500 mb-3">by <span className="font-medium text-slate-700">{cert.creator_name}</span></p>
                  <div className="border-t border-slate-50 pt-3 space-y-1">
                    <p className="text-xs text-slate-400 font-mono truncate">{cert.verification_id}</p>
                    <p className="text-xs text-slate-400">{new Date(cert.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                  </div>
                  <Link to={`/verify/${cert.verification_id}`}
                    className="mt-4 flex items-center justify-center gap-2 w-full py-2 bg-gray-50 text-gray-900 text-xs font-medium rounded-xl hover:bg-gray-100 transition-colors"
                    data-testid="view-certificate-link">
                    View Certificate <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-10">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="flex items-center gap-1 px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                  <ChevronLeft className="w-4 h-4" /> Prev
                </button>
                <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="flex items-center gap-1 px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
