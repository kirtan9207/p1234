import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { api } from '../context/AuthContext';
import { Eye, EyeOff } from 'lucide-react';

export default function AuthPage() {
  const [tab, setTab] = useState('login');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'creator' });
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = tab === 'login' ? '/auth/login' : '/auth/register';
      const payload = tab === 'login' ? { email: form.email, password: form.password } : form;
      const res = await api.post(endpoint, payload);
      login(res.data.token, res.data.user);
      toast.success(tab === 'login' ? 'Welcome back!' : 'Account created!');
      const role = res.data.user.role;
      navigate(role === 'reviewer' ? '/review' : '/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (email, password) => setForm(f => ({ ...f, email, password }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 bg-white border-2 border-gray-100 shadow-sm">
            <img
              src="https://customer-assets.emergentagent.com/job_content-cert/artifacts/e38yr6wn_fountain-pen-writing-logo-design-design-concept-free-vector.jpg"
              alt="TrustInk" className="w-10 h-10 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">TrustInk</h1>
          <p className="text-slate-500 text-sm mt-1">Verified Human Content Certification</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
          <div className="flex border-b border-slate-100">
            {['login', 'register'].map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-4 text-sm font-medium transition-colors capitalize ${tab === t ? 'text-gray-900 border-b-2 border-gray-900 bg-gray-50/50' : 'text-slate-500 hover:text-slate-700'}`}
                data-testid={`tab-${t}`}
              >
                {t === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-4">
            {tab === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Full Name</label>
                <input name="name" value={form.name} onChange={handleChange} required
                  placeholder="John Doe" data-testid="name-input"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400 transition-all" />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Email</label>
              <input name="email" type="email" value={form.email} onChange={handleChange} required
                placeholder="you@example.com" data-testid="email-input"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400 transition-all" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Password</label>
              <div className="relative">
                <input name="password" type={showPass ? 'text' : 'password'} value={form.password} onChange={handleChange} required
                  placeholder="••••••••" data-testid="password-input"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400 transition-all pr-12" />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-3 text-slate-400 hover:text-slate-600">
                  {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {tab === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Account Type</label>
                <select name="role" value={form.role} onChange={handleChange}
                  data-testid="role-select"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400 transition-all bg-white">
                  <option value="creator">Content Creator</option>
                  <option value="reviewer">Content Reviewer</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
            )}

            <button type="submit" disabled={loading} data-testid="auth-submit-button"
              className="w-full py-3 bg-gray-900 text-white font-semibold rounded-xl hover:bg-black disabled:opacity-60 disabled:cursor-not-allowed transition-colors mt-2">
              {loading ? 'Please wait...' : tab === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {tab === 'login' && (
            <div className="px-8 pb-8 pt-0">
              <p className="text-xs text-slate-400 text-center mb-3">Demo Accounts</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Creator', email: 'creator@trustink.com', pw: 'creator123' },
                  { label: 'Reviewer', email: 'reviewer@trustink.com', pw: 'review123' },
                  { label: 'Admin', email: 'admin@trustink.com', pw: 'admin123' },
                ].map(d => (
                  <button key={d.label} onClick={() => fillDemo(d.email, d.pw)}
                    className="text-xs py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                    data-testid={`demo-${d.label.toLowerCase()}`}>
                    {d.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400 text-center mt-2">Click to fill credentials, then Sign In</p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button onClick={() => setTab(tab === 'login' ? 'register' : 'login')} className="text-gray-900 hover:underline font-medium">
            {tab === 'login' ? 'Create one' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
