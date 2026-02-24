import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../context/AuthContext';
import { Shield, CheckCircle, FileText, Award, Users, Lock, Zap, Globe, ArrowRight, Star } from 'lucide-react';

const features = [
  { icon: Shield, title: 'AI Detection', desc: 'Advanced algorithms analyze writing patterns to distinguish human vs AI-generated content.', color: 'bg-indigo-50 text-indigo-600' },
  { icon: FileText, title: 'Stylometry Analysis', desc: 'Deep linguistic fingerprinting examines vocabulary, sentence structure, and writing style.', color: 'bg-violet-50 text-violet-600' },
  { icon: Lock, title: 'Cryptographic Signing', desc: 'SHA-256 content hashing and HMAC signatures ensure tamper-proof certificate authenticity.', color: 'bg-blue-50 text-blue-600' },
  { icon: Award, title: 'Digital Certificates', desc: 'Issue verifiable badges with unique IDs that can be embedded on any website or platform.', color: 'bg-emerald-50 text-emerald-600' },
  { icon: Users, title: 'Trust Score Engine', desc: 'Dynamic creator reputation scoring routes content through appropriate verification paths.', color: 'bg-amber-50 text-amber-600' },
  { icon: Globe, title: 'Public Registry', desc: 'Open, searchable ledger of all verified human-created content for public validation.', color: 'bg-rose-50 text-rose-600' },
];

const steps = [
  { num: '01', title: 'Submit Content', desc: 'Paste your text or provide a URL. Our system fetches and normalizes your content.' },
  { num: '02', title: 'AI Verification', desc: 'Multi-layer analysis: AI detection, stylometry fingerprinting, and trust scoring.' },
  { num: '03', title: 'Get Certified', desc: 'Receive a tamper-proof certificate with a unique verification ID and embeddable badge.' },
];

export default function LandingPage() {
  const [stats, setStats] = useState({ total_certificates: 0, total_creators: 0, total_submissions: 0 });

  useEffect(() => {
    api.get('/registry/stats').then(r => setStats(r.data)).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <section className="relative overflow-hidden bg-white border-b border-slate-100">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-violet-50 pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 py-20 sm:py-28 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium mb-6 animate-fade-in-up">
            <Zap className="w-4 h-4" />
            Open-Source Content Authentication
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold text-slate-900 leading-tight mb-6 animate-fade-in-up delay-100">
            Certify Your<br />
            <span className="gradient-text">Human-Written</span> Content
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-10 animate-fade-in-up delay-200">
            The trusted framework for authenticating original human content. Issue tamper-proof digital badges,
            maintain a public verification registry, and build trust with your audience.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up delay-300">
            <Link to="/auth" className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
              Get Certified <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/registry" className="inline-flex items-center gap-2 px-6 py-3 bg-white text-slate-700 font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
              <Globe className="w-4 h-4" /> View Registry
            </Link>
          </div>

          {/* Badge preview */}
          <div className="mt-16 flex justify-center animate-fade-in-up delay-400">
            <div className="animate-pulse-ring inline-flex items-center gap-3 px-6 py-3 bg-white rounded-2xl shadow-xl border border-indigo-100">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="text-left">
                <div className="text-xs text-slate-500 font-medium">VERIFICATION ID</div>
                <div className="text-sm font-bold text-slate-800">VH-2026-A3F9C2</div>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div className="badge-shine text-white text-xs font-bold px-3 py-1.5 rounded-full">
                Verified Human Content
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-indigo-600 py-12">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-3 gap-8 text-center">
          {[
            { label: 'Certificates Issued', value: stats.total_certificates },
            { label: 'Registered Creators', value: stats.total_creators },
            { label: 'Content Submissions', value: stats.total_submissions },
          ].map((s, i) => (
            <div key={i} className="animate-fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="text-3xl sm:text-4xl font-bold text-white">{s.value.toLocaleString()}</div>
              <div className="text-indigo-200 text-sm mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">How It Works</h2>
            <p className="text-slate-500">Three simple steps to certified human content</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((s, i) => (
              <div key={i} className="relative text-center p-8 rounded-2xl bg-slate-50 card-hover">
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-indigo-200 z-10" />
                )}
                <div className="text-5xl font-black text-indigo-100 mb-4">{s.num}</div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">{s.title}</h3>
                <p className="text-sm text-slate-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Platform Features</h2>
            <p className="text-slate-500">Enterprise-grade verification for creators and publishers</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-slate-100 card-hover">
                <div className={`w-12 h-12 ${f.color} rounded-xl flex items-center justify-center mb-4`}>
                  <f.icon className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-slate-800 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-indigo-600 to-violet-600">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <Star className="w-12 h-12 text-yellow-300 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-white mb-4">Start Certifying Your Content Today</h2>
          <p className="text-indigo-200 mb-8">Join creators and publishers building trust through verified human content.</p>
          <Link to="/auth" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-indigo-700 font-bold rounded-xl hover:bg-indigo-50 transition-colors shadow-xl">
            Create Free Account <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <footer className="bg-slate-900 text-slate-400 py-8 text-center text-sm">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-indigo-400" />
          <span className="text-white font-semibold">VHCCS</span>
        </div>
        <p>Verified Human Content Certification System — Open Source</p>
      </footer>
    </div>
  );
}
