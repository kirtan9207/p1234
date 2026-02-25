import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../context/AuthContext';
import { CheckCircle, XCircle, Shield, Copy, ExternalLink, AlertTriangle, Clock, Download } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function CertificatePage() {
  const { verificationId } = useParams();
  const [cert, setCert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!verificationId) { setNotFound(true); setLoading(false); return; }
    api.get(`/verify/${verificationId}`)
      .then(async r => {
        const verifyData = r.data;
        // Also fetch full cert to get id for PDF
        try {
          const certsRes = await api.get(`/registry?search=${verificationId}&limit=50`);
          const match = certsRes.data.certificates?.find(c => c.verification_id === verificationId);
          if (match) verifyData.id = match.id;
        } catch (_) {}
        setCert(verifyData);
        setLoading(false);
      })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [verificationId]);

  const copyHash = () => {
    if (cert?.content_hash) {
      navigator.clipboard.writeText(cert.content_hash);
      toast.success('Hash copied!');
    }
  };

  const downloadPDF = async () => {
    try {
      const res = await api.get(`/certificates/${cert.id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `VHCCS-${cert.verification_id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded!');
    } catch (e) {
      toast.error('Failed to download PDF');
    }
  };

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-8 h-8 text-rose-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Verification Not Found</h2>
        <p className="text-slate-500 mb-6">The verification ID <code className="font-mono text-indigo-600">{verificationId}</code> was not found in our registry.</p>
        <Link to="/registry" className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">Browse Registry</Link>
      </div>
    </div>
  );

  const isValid = cert.valid && cert.status === 'active';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Badge */}
        <div className={`rounded-3xl p-8 text-center mb-6 shadow-xl border-2 ${isValid ? 'bg-white border-emerald-200' : 'bg-white border-rose-200'}`} data-testid="certificate-card">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${isValid ? 'bg-emerald-100' : 'bg-rose-100'}`}>
            {isValid ? (
              <CheckCircle className="w-10 h-10 text-emerald-600" />
            ) : (
              <XCircle className="w-10 h-10 text-rose-500" />
            )}
          </div>

          {isValid ? (
            <>
              <div className="inline-flex items-center gap-2 px-5 py-2 badge-shine text-white rounded-full text-sm font-bold mb-4">
                <Shield className="w-4 h-4" /> Verified Human Content
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">{cert.content_title}</h1>
              <p className="text-slate-500">by <span className="font-semibold text-slate-700">{cert.creator_name}</span></p>
              <button onClick={downloadPDF}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors"
                data-testid="download-pdf-btn">
                <Download className="w-4 h-4" /> Download Certificate PDF
              </button>
            </>
          ) : (
            <>
              <div className="inline-flex items-center gap-2 px-5 py-2 bg-rose-500 text-white rounded-full text-sm font-bold mb-4">
                <AlertTriangle className="w-4 h-4" /> Certificate Revoked
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">{cert.content_title}</h1>
              <p className="text-slate-500">by <span className="font-semibold text-slate-700">{cert.creator_name}</span></p>
              {cert.revocation_reason && (
                <div className="mt-4 p-3 bg-rose-50 rounded-xl border border-rose-100">
                  <p className="text-sm text-rose-700"><strong>Revocation reason:</strong> {cert.revocation_reason}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Details */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-slate-800 border-b border-slate-100 pb-3">Certificate Details</h2>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">Verification ID</p>
              <p className="font-mono text-indigo-600 font-medium" data-testid="verification-id">{cert.verification_id}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">Status</p>
              <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold ${isValid ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                {isValid ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                {cert.status}
              </span>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">Issued</p>
              <p className="text-slate-700 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {new Date(cert.timestamp).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">Creator</p>
              <p className="text-slate-700 font-medium">{cert.creator_name}</p>
            </div>
          </div>

          {/* Content Hash */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">SHA-256 Content Hash</p>
              <button onClick={copyHash} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800" data-testid="copy-hash-btn">
                <Copy className="w-3 h-3" /> Copy
              </button>
            </div>
            <code className="block bg-slate-50 text-slate-600 text-xs font-mono p-3 rounded-xl border border-slate-100 break-all" data-testid="content-hash">
              {cert.content_hash}
            </code>
          </div>

          {/* Signature */}
          {cert.signature && (
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">HMAC Signature</p>
              <code className="block bg-slate-50 text-slate-500 text-xs font-mono p-3 rounded-xl border border-slate-100 break-all">
                {cert.signature}
              </code>
            </div>
          )}
        </div>

        {/* Embed */}
        {isValid && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mt-4">
            <h3 className="font-semibold text-slate-800 mb-3 text-sm">Embed This Badge</h3>
            <pre className="bg-slate-900 text-emerald-400 text-xs font-mono rounded-xl p-4 overflow-x-auto">
{`<a href="${BACKEND_URL}/verify/${cert.verification_id}" target="_blank"
   style="display:inline-flex;align-items:center;gap:8px;
          padding:8px 16px;background:linear-gradient(135deg,#4f46e5,#7c3aed);
          color:white;border-radius:24px;font-family:-apple-system,sans-serif;
          font-size:13px;font-weight:600;text-decoration:none;">
  Verified Human Content
</a>`}
            </pre>
            <button onClick={() => { navigator.clipboard.writeText(`<a href="${BACKEND_URL}/verify/${cert.verification_id}" target="_blank" style="display:inline-flex;align-items:center;gap:8px;padding:8px 16px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:white;border-radius:24px;font-family:-apple-system,sans-serif;font-size:13px;font-weight:600;text-decoration:none;">Verified Human Content</a>`); toast.success('Embed code copied!'); }}
              className="mt-3 flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800" data-testid="copy-embed-code">
              <Copy className="w-4 h-4" /> Copy Embed Code
            </button>
          </div>
        )}

        <div className="text-center mt-6">
          <Link to="/registry" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 transition-colors">
            <ExternalLink className="w-4 h-4" /> Browse Public Registry
          </Link>
        </div>
      </div>
    </div>
  );
}
