# VHCCS — Product Requirements Document

## Original Problem Statement
Verified Human Content Certification System (VHCCS): An open-source framework to authenticate text content and issue "Verified Human Created" badges using AI detection, stylometry, cryptographic signing, and trust-based moderation workflows.

## Architecture
- **Backend**: FastAPI + MongoDB (via Motor async driver)
- **Frontend**: React + Tailwind CSS + shadcn/ui components
- **Auth**: JWT tokens (HS256), bcrypt password hashing
- **Certificates**: SHA-256 content hash + HMAC-SHA256 signature + unique verification IDs (VH-YYYY-XXXXXX)
- **AI Detection**: MOCKED (text heuristics-based scoring — production would use HuggingFace transformers)
- **Stylometry**: MOCKED (word count, vocab richness, sentence patterns)

## User Personas
1. **Content Creator** — submits articles/text, views trust score, gets certified, generates badge embed code
2. **Reviewer** — moderates pending/flagged submissions, approves/rejects with notes
3. **Admin** — full access to both creator and reviewer features, can revoke certificates

## Core Requirements (Static)
- JWT authentication with 3 roles: creator, reviewer, admin
- Content submission with AI detection + stylometry analysis
- Trust score engine (0-100, starts at 50): +10 approved, -20 rejected, -50 fraud, +5 identity verified
- High trust (80+) → auto-approval path; Medium/Low → manual moderation queue
- Certificate issuance: SHA-256 hash + HMAC signature + verification ID
- Public verification registry with search
- Badge embed code generation
- Certificate revocation system

## What's Been Implemented (Feb 2026)
### Backend (/app/backend/server.py)
- POST /api/auth/register, POST /api/auth/login, GET /api/auth/me
- POST /api/submissions, GET /api/submissions, GET /api/submissions/{id}
- GET /api/moderation/queue, GET /api/moderation/stats, POST /api/moderation/{sid}/review (with Resend email notifications)
- GET /api/certificates/{id}, GET /api/certificates/{id}/pdf (PDF download - reportlab)
- GET /api/verify/{vid}
- GET /api/registry, GET /api/registry/stats
- GET /api/dashboard/stats
- GET /api/admin/users, POST /api/admin/users/{uid}/status, PUT /api/admin/users/{uid}/trust
- GET /api/admin/stats, POST /api/admin/revoke/{cid}
- POST /api/apikeys, GET /api/apikeys, DELETE /api/apikeys/{key_id}
- GET /api/v1/verify/{vid} (third-party API key validation)
- GET /api/creators/{uid}/profile
- POST /api/seed (demo data)
- Real HuggingFace AI detection (roberta-base-openai-detector) with mock fallback
- Trust score engine, certificate issuance with SHA-256 + HMAC signing
- Resend email notifications for submission status changes
- MongoDB indexes for performance

### Frontend (/app/frontend/src/)
- LandingPage.js — Hero, stats, how-it-works, features, CTA
- AuthPage.js — Login/Register with demo account buttons
- CreatorDashboard.js — Overview stats, Submit form with AI/stylometry results, History table, Badge Generator, API Keys tab
- ReviewerPanel.js — Moderation queue table, detailed Review Modal with approve/reject
- AdminPanel.js — User management (ban/suspend/activate), trust score editor, system overview stats
- PublicRegistry.js — Searchable certificate grid with pagination
- CertificatePage.js — Public certificate verification with hash/signature display + embed code + PDF download
- Navbar.js — Responsive nav with role-based links (Admin link for admin only), user dropdown
- AuthContext.js — JWT auth state management with axios interceptors

## Demo Accounts
- admin@vhccs.com / admin123 (trust: 100, auto-approves)
- reviewer@vhccs.com / review123 (reviewer role)
- creator@vhccs.com / creator123 (trust: 50, pending review)

## Test Results (Feb 2026)
- Backend: 100% pass (18/18 tests)
- Frontend: 100% pass (all flows)

## Prioritized Backlog

### P0 (Critical - Must Have)
- [x] JWT Authentication
- [x] Content submission + AI/stylometry analysis
- [x] Trust score engine
- [x] Certificate issuance (SHA-256 + HMAC)
- [x] Public verification registry
- [x] Reviewer moderation panel
- [x] Badge embed code

### P1 (Important - Next Phase)
- [x] Real HuggingFace AI detection (roberta-base-openai-detector with mock fallback)
- [x] Email notifications (Resend) for submission approve/reject/revision
- [x] Admin user management panel (ban/suspend/activate, trust score editing)
- [x] PDF certificate download (reportlab)
- [x] API key system for third-party badge validation (/api/v1/verify)
- [ ] Real spaCy stylometry analysis
- [ ] Plagiarism/similarity detection (TF-IDF cosine similarity)
- [ ] Creator identity verification workflow

### P2 (Nice to Have)
- [ ] Creator profile pages (public)
- [ ] Content URL fetching (auto-extract text from URLs)
- [ ] Dashboard analytics charts (Recharts)
- [ ] Fraud report system (community flagging)
- [ ] Redis caching for trust scores
- [ ] Batch submission support
- [ ] Webhook notifications for status changes
- [ ] Dark mode

## Next Tasks
1. Integrate real HuggingFace AI detection model
2. Add email notifications for submission status changes
3. Build admin user management interface
4. Add PDF certificate download
5. Implement API key system for third-party validation
