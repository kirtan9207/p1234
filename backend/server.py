from fastapi import FastAPI, APIRouter, HTTPException, Depends, Query, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, hashlib, hmac, secrets, random, re, uuid, asyncio, resend, requests
from pathlib import Path
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import jwt, JWTError
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_LEFT

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET = os.environ.get('JWT_SECRET_KEY', 'vhccs-dev-secret-2026-change-in-prod')
JWT_ALGORITHM = 'HS256'
HMAC_SECRET = os.environ.get('HMAC_SECRET_KEY', 'vhccs-hmac-dev-2026-change-in-prod')
HIGH_TRUST_THRESHOLD = 80
HF_API_URL = "https://api-inference.huggingface.co/models/roberta-base-openai-detector"
HF_TOKEN = os.environ.get('HF_API_TOKEN', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'https://content-cert.preview.emergentagent.com')
resend.api_key = os.environ.get('RESEND_API_KEY', '')

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="TrustInk API")
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─── MODELS ───────────────────────────────────────────────
class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "creator"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class SubmissionCreate(BaseModel):
    title: str
    content_text: str
    content_url: Optional[str] = None

class ReviewDecision(BaseModel):
    decision: str
    notes: str = ""

class RevocationReq(BaseModel):
    reason: str

class APIKeyCreate(BaseModel):
    name: str

class UserStatusUpdate(BaseModel):
    status: str  # active | suspended | banned

class TrustScoreUpdate(BaseModel):
    trust_score: int

# ─── HELPERS ──────────────────────────────────────────────
def hash_pw(pw): return pwd_context.hash(pw)
def verify_pw(plain, hashed): return pwd_context.verify(plain, hashed)

def make_token(uid: str, email: str, role: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=24)
    return jwt.encode({"sub": uid, "email": email, "role": role, "exp": exp}, JWT_SECRET, algorithm=JWT_ALGORITHM)

def clean(d):
    if not d: return None
    d = dict(d)
    d.pop('_id', None)
    return d

def tl(score): return "high" if score >= HIGH_TRUST_THRESHOLD else ("medium" if score >= 50 else "low")

async def current_user(creds: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        uid = payload.get("sub")
        if not uid: raise HTTPException(401, "Invalid token")
    except JWTError:
        raise HTTPException(401, "Invalid token")
    u = await db.users.find_one({"id": uid})
    if not u: raise HTTPException(401, "User not found")
    return clean(u)

async def reviewer_only(u=Depends(current_user)):
    if u["role"] not in ["reviewer", "admin"]: raise HTTPException(403, "Reviewer access required")
    return u

async def admin_only(u=Depends(current_user)):
    if u["role"] != "admin": raise HTTPException(403, "Admin access required")
    return u

# ─── AI DETECTION (HuggingFace roberta-base-openai-detector + mock fallback) ─
def _mock_ai(text: str) -> dict:
    words = text.split()
    sentences = [s.strip() for s in re.split(r'[.!?]+', text) if s.strip()]
    if not sentences:
        return {"human_probability": 0.5, "ai_probability": 0.5, "confidence": "low", "source": "mock"}
    avg_sl = len(words) / max(len(sentences), 1)
    vocab_r = len(set(w.lower() for w in words)) / max(len(words), 1)
    variance = 0
    if len(sentences) > 1:
        sl = [len(s.split()) for s in sentences]
        variance = sum((x - avg_sl) ** 2 for x in sl) / len(sl)
    score = 0.62
    if vocab_r > 0.5: score += 0.10
    if variance > 10: score += 0.07
    if avg_sl < 25: score += 0.05
    if any(c in text for c in ['!', '?', '—', '…', '\u201c', '\u201d']): score += 0.04
    if len(text) > 500: score += 0.03
    score += random.uniform(-0.07, 0.07)
    score = max(0.28, min(0.97, score))
    conf = "high" if score > 0.82 or score < 0.35 else ("medium" if score > 0.6 else "low")
    return {"human_probability": round(score, 3), "ai_probability": round(1 - score, 3), "confidence": conf, "source": "mock"}

async def analyze_ai(text: str) -> dict:
    """Real AI detection via HuggingFace roberta-base-openai-detector, fallback to mock."""
    headers = {"Content-Type": "application/json"}
    if HF_TOKEN:
        headers["Authorization"] = f"Bearer {HF_TOKEN}"
    text_truncated = text[:1500]

    def call_hf():
        return requests.post(HF_API_URL, headers=headers, json={"inputs": text_truncated}, timeout=12)

    try:
        resp = await asyncio.to_thread(call_hf)
        if resp.status_code == 200:
            data = resp.json()
            # Response: [[{label,score},...]] or [{label,score},...]
            results = data[0] if (data and isinstance(data[0], list)) else data
            if isinstance(results, list) and results:
                human_score = next((r['score'] for r in results if r.get('label') == 'Real'), None)
                ai_score = next((r['score'] for r in results if r.get('label') == 'Fake'), None)
                if human_score is not None and ai_score is not None:
                    top = max(human_score, ai_score)
                    conf = "high" if top > 0.85 else ("medium" if top > 0.65 else "low")
                    return {"human_probability": round(human_score, 3), "ai_probability": round(ai_score, 3),
                            "confidence": conf, "source": "roberta-openai-detector"}
        logger.warning(f"HuggingFace API returned {resp.status_code}, using mock fallback")
    except Exception as e:
        logger.warning(f"HuggingFace API error: {e}, using mock fallback")
    return _mock_ai(text)

# ─── STYLOMETRY (MOCKED) ──────────────────────────────────
def analyze_style(text: str) -> dict:
    words = text.split()
    sentences = [s.strip() for s in re.split(r'[.!?]+', text) if s.strip()]
    avg_wl = sum(len(w) for w in words) / max(len(words), 1)
    avg_sl = len(words) / max(len(sentences), 1)
    vr = len(set(w.lower() for w in words)) / max(len(words), 1)
    pd = sum(1 for c in text if c in '.,!?;:\u2014"\'') / max(len(text), 1)

    s = 0.5
    if 3 < avg_wl < 8: s += 0.12
    if 10 < avg_sl < 30: s += 0.12
    if vr > 0.4: s += 0.14
    if pd > 0.02: s += 0.08
    s += random.uniform(-0.04, 0.04)
    s = max(0.1, min(0.99, s))
    return {
        "score": round(s, 3),
        "avg_word_length": round(avg_wl, 2),
        "avg_sentence_length": round(avg_sl, 2),
        "vocabulary_richness": round(vr, 3),
        "word_count": len(words),
        "sentence_count": len(sentences)
    }

# ─── TRUST ENGINE ─────────────────────────────────────────
TRUST_DELTAS = {"approved": 10, "rejected": -20, "fraud": -50, "identity_verified": 5}

async def update_trust(uid: str, action: str):
    delta = TRUST_DELTAS.get(action, 0)
    if not delta: return
    u = await db.users.find_one({"id": uid})
    if not u: return
    new_score = max(0, min(100, u.get("trust_score", 50) + delta))
    upd = {"trust_score": new_score}
    if action == "approved": upd["verified_posts"] = u.get("verified_posts", 0) + 1
    if action == "rejected": upd["rejected_posts"] = u.get("rejected_posts", 0) + 1
    await db.users.update_one({"id": uid}, {"$set": upd})

# ─── CERTIFICATES ─────────────────────────────────────────
def content_hash(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()

def sign_cert(ch: str, vid: str) -> str:
    msg = f"{ch}:{vid}".encode()
    return hmac.new(HMAC_SECRET.encode(), msg, hashlib.sha256).hexdigest()

def new_vid() -> str:
    return f"VH-{datetime.now(timezone.utc).year}-{secrets.token_hex(3).upper()}"

async def issue_cert(sub: dict) -> dict:
    ch = content_hash(sub.get("content_text", ""))
    vid = new_vid()
    sig = sign_cert(ch, vid)
    cert = {
        "id": str(uuid.uuid4()),
        "submission_id": sub["id"],
        "creator_id": sub["creator_id"],
        "creator_name": sub.get("creator_name", ""),
        "content_title": sub.get("title", ""),
        "verification_id": vid,
        "content_hash": ch,
        "signature": sig,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": "active",
        "revoked_at": None,
        "revocation_reason": None
    }
    await db.certificates.insert_one(cert.copy())
    await db.submissions.update_one(
        {"id": sub["id"]},
        {"$set": {"certificate_id": cert["id"], "verification_id": vid}}
    )
    return cert

# ─── EMAIL NOTIFICATIONS (Resend) ─────────────────────────
async def send_status_email(creator_email: str, creator_name: str, title: str, status: str, notes: str = '', vid: str = ''):
    if not resend.api_key:
        return
    cfg = {
        'approved': ('#10b981', 'Submission Approved!', f'Your content <strong>"{title}"</strong> has been verified and certified as human-written.'),
        'rejected': ('#ef4444', 'Submission Not Approved', f'Your submission <strong>"{title}"</strong> was not approved at this time.'),
        'revision_requested': ('#f59e0b', 'Revision Requested', f'Your submission <strong>"{title}"</strong> requires some revisions before it can be certified.'),
    }
    color, subject_suffix, msg = cfg.get(status, ('#6366f1', 'Status Update', f'Your submission <strong>"{title}"</strong> status has been updated.'))
    badge_html = f'<p><a href="{FRONTEND_URL}/verify/{vid}" style="display:inline-block;padding:10px 20px;background:{color};color:white;border-radius:20px;text-decoration:none;font-weight:600;font-size:13px;">View Certificate</a></p>' if status == 'approved' and vid else ''
    notes_html = f'<p style="color:#64748b;"><strong>Reviewer notes:</strong> {notes}</p>' if notes else ''
    html = f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:20px;">
      <div style="background:white;border-radius:16px;padding:40px;border:1px solid #e2e8f0;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="display:inline-block;width:56px;height:56px;background:{color}20;border-radius:50%;line-height:56px;font-size:28px;margin-bottom:12px;">{'✓' if status=='approved' else '✗' if status=='rejected' else '↻'}</div>
          <h2 style="color:#1e293b;margin:0;font-size:22px;">{subject_suffix}</h2>
        </div>
        <p style="color:#475569;">Hi <strong>{creator_name}</strong>,</p>
        <p style="color:#475569;">{msg}</p>
        {notes_html}
        {badge_html}
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
        <p style="color:#94a3b8;font-size:12px;text-align:center;">TrustInk — Verified Human Content Certification</p>
      </div>
    </div>"""
    try:
        params = {"from": SENDER_EMAIL, "to": [creator_email],
                  "subject": f"TrustInk: {subject_suffix} — {title}", "html": html}
        await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Email sent to {creator_email} status={status}")
    except Exception as e:
        logger.warning(f"Email send failed: {e}")

# ─── PDF CERTIFICATE GENERATION ───────────────────────────
def build_cert_pdf(cert: dict) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=0.8*inch, bottomMargin=0.8*inch,
                            leftMargin=0.8*inch, rightMargin=0.8*inch)
    styles = getSampleStyleSheet()
    indigo = HexColor('#4f46e5')
    emerald = HexColor('#10b981')
    slate = HexColor('#1e293b')
    muted = HexColor('#64748b')

    title_style = ParagraphStyle('title', fontSize=26, textColor=HexColor('#111827'), alignment=TA_CENTER,
                                  spaceAfter=4, fontName='Helvetica-Bold')
    sub_style = ParagraphStyle('sub', fontSize=12, textColor=muted, alignment=TA_CENTER, spaceAfter=6)
    label_style = ParagraphStyle('label', fontSize=8, textColor=muted, fontName='Helvetica-Bold',
                                  spaceBefore=12, spaceAfter=2)
    value_style = ParagraphStyle('value', fontSize=10, textColor=slate, spaceAfter=4, leading=14)
    mono_style = ParagraphStyle('mono', fontSize=7, textColor=slate, fontName='Courier',
                                 spaceAfter=4, leading=10, wordWrap='CJK')

    ts = datetime.fromisoformat(cert.get('timestamp', datetime.now(timezone.utc).isoformat()))
    is_active = cert.get('status') == 'active'

    elements = [
        Paragraph("TrustInk", title_style),
        Paragraph("Verified Human Content Certification", sub_style),
        HRFlowable(width="100%", thickness=2, color=HexColor('#111827'), spaceAfter=16),
        Spacer(1, 0.1*inch),
        Paragraph(f"{'Certificate of Authenticity' if is_active else 'REVOKED CERTIFICATE'}", ParagraphStyle(
            'cert_title', fontSize=20, textColor=emerald if is_active else HexColor('#ef4444'),
            alignment=TA_CENTER, fontName='Helvetica-Bold', spaceAfter=4)),
        Paragraph("This certifies that the following content has been verified as human-written" if is_active
                  else "This certificate has been revoked.", sub_style),
        Spacer(1, 0.2*inch),
    ]

    data = [
        ['Content Title', cert.get('content_title', 'N/A')],
        ['Creator', cert.get('creator_name', 'N/A')],
        ['Verification ID', cert.get('verification_id', 'N/A')],
        ['Status', cert.get('status', 'N/A').upper()],
        ['Issued', ts.strftime('%B %d, %Y at %H:%M UTC')],
    ]
    if cert.get('revocation_reason'):
        data.append(['Revocation Reason', cert['revocation_reason']])

    tbl = Table(data, colWidths=[1.8*inch, 5.0*inch])
    tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), HexColor('#f1f5f9')),
        ('TEXTCOLOR', (0, 0), (0, -1), HexColor('#111827')),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('PADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#e2e8f0')),
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [white, HexColor('#fafafa')]),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(tbl)
    elements.append(Spacer(1, 0.2*inch))
    elements.append(Paragraph("SHA-256 CONTENT HASH", label_style))
    elements.append(Paragraph(cert.get('content_hash', 'N/A'), mono_style))
    elements.append(Paragraph("HMAC-SHA256 SIGNATURE", label_style))
    elements.append(Paragraph(cert.get('signature', 'N/A'), mono_style))
    elements.append(Spacer(1, 0.2*inch))
    elements.append(HRFlowable(width="100%", thickness=1, color=HexColor('#e2e8f0')))
    elements.append(Paragraph(f"Verify at: {FRONTEND_URL}/verify/{cert.get('verification_id', '')}",
                               ParagraphStyle('footer', fontSize=8, textColor=muted, alignment=TA_CENTER, spaceBefore=8)))

    doc.build(elements)
    return buffer.getvalue()
r = APIRouter(prefix="/api")

# AUTH
@r.post("/auth/register")
async def register(d: UserRegister):
    if await db.users.find_one({"email": d.email}):
        raise HTTPException(400, "Email already registered")
    uid = str(uuid.uuid4())
    role = d.role if d.role in ["creator", "reviewer", "admin"] else "creator"
    u = {
        "id": uid, "name": d.name, "email": d.email,
        "password_hash": hash_pw(d.password), "role": role,
        "trust_score": 50, "verified_posts": 0, "rejected_posts": 0,
        "identity_verified": False, "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(u.copy())
    return {
        "token": make_token(uid, d.email, role),
        "user": {"id": uid, "name": u["name"], "email": u["email"],
                 "role": role, "trust_score": 50, "trust_level": "medium"}
    }

@r.post("/auth/login")
async def login(d: UserLogin):
    u = await db.users.find_one({"email": d.email})
    if not u or not verify_pw(d.password, u["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    if u.get("status") == "banned":
        raise HTTPException(403, "Account banned")
    return {
        "token": make_token(u["id"], u["email"], u["role"]),
        "user": {"id": u["id"], "name": u["name"], "email": u["email"],
                 "role": u["role"], "trust_score": u.get("trust_score", 50),
                 "trust_level": tl(u.get("trust_score", 50))}
    }

@r.get("/auth/me")
async def me(u=Depends(current_user)):
    u = dict(u)
    u.pop("password_hash", None)
    u["trust_level"] = tl(u.get("trust_score", 50))
    return u

# SUBMISSIONS
@r.post("/submissions")
async def submit(d: SubmissionCreate, u=Depends(current_user)):
    if len(d.content_text.strip()) < 50:
        raise HTTPException(400, "Content must be at least 50 characters")

    ai = await analyze_ai(d.content_text)
    style = analyze_style(d.content_text)
    trust = tl(u.get("trust_score", 50))

    if trust == "high" and ai["human_probability"] >= 0.75:
        status = "approved"
    elif ai["human_probability"] < 0.40:
        status = "flagged"
    else:
        status = "pending"

    sid = str(uuid.uuid4())
    sub = {
        "id": sid, "creator_id": u["id"], "creator_name": u["name"],
        "title": d.title, "content_text": d.content_text, "content_url": d.content_url,
        "ai_human_probability": ai["human_probability"],
        "ai_ai_probability": ai["ai_probability"],
        "ai_confidence": ai["confidence"],
        "stylometry_score": style["score"],
        "stylometry_features": style,
        "status": status, "review_notes": None, "reviewer_id": None,
        "certificate_id": None, "verification_id": None,
        "created_at": datetime.now(timezone.utc).isoformat(), "reviewed_at": None
    }
    await db.submissions.insert_one(sub.copy())

    if status == "approved":
        cert = await issue_cert(sub)
        await update_trust(u["id"], "approved")
        sub["verification_id"] = cert["verification_id"]
        sub["certificate_id"] = cert["id"]

    sub.pop("_id", None)
    return sub

@r.get("/submissions")
async def list_subs(u=Depends(current_user)):
    q = {} if u["role"] in ["reviewer", "admin"] else {"creator_id": u["id"]}
    return await db.submissions.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)

@r.get("/submissions/{sid}")
async def get_sub(sid: str, u=Depends(current_user)):
    s = await db.submissions.find_one({"id": sid}, {"_id": 0})
    if not s: raise HTTPException(404, "Not found")
    if u["role"] not in ["reviewer", "admin"] and s["creator_id"] != u["id"]:
        raise HTTPException(403, "Access denied")
    return s

# MODERATION
@r.get("/moderation/stats")
async def mod_stats(u=Depends(reviewer_only)):
    return {
        "pending": await db.submissions.count_documents({"status": "pending"}),
        "flagged": await db.submissions.count_documents({"status": "flagged"}),
        "approved": await db.submissions.count_documents({"status": "approved"}),
        "rejected": await db.submissions.count_documents({"status": "rejected"})
    }

@r.get("/moderation/queue")
async def queue(u=Depends(reviewer_only)):
    pipeline = [
        {"$match": {"status": {"$in": ["pending", "flagged"]}}},
        {"$lookup": {"from": "users", "localField": "creator_id", "foreignField": "id", "as": "creator_doc"}},
        {"$sort": {"created_at": 1}},
        {"$limit": 100}
    ]
    subs = await db.submissions.aggregate(pipeline).to_list(100)
    result = []
    for s in subs:
        s.pop("_id", None)
        creator_list = s.pop("creator_doc", [])
        creator = creator_list[0] if creator_list else {}
        s["creator_trust_score"] = creator.get("trust_score", 50)
        s["creator_trust_level"] = tl(s["creator_trust_score"])
        result.append(s)
    return result

@r.post("/moderation/{sid}/review")
async def review(sid: str, d: ReviewDecision, u=Depends(reviewer_only)):
    s = await db.submissions.find_one({"id": sid})
    if not s: raise HTTPException(404, "Not found")
    if s["status"] not in ["pending", "flagged", "reviewing"]:
        raise HTTPException(400, "Submission not reviewable")
    if d.decision not in ["approved", "rejected", "revision_requested"]:
        raise HTTPException(400, "Invalid decision")

    upd = {"status": d.decision, "review_notes": d.notes,
           "reviewer_id": u["id"], "reviewed_at": datetime.now(timezone.utc).isoformat()}
    await db.submissions.update_one({"id": sid}, {"$set": upd})

    if d.decision == "approved":
        s_dict = clean(s)
        s_dict.update(upd)
        cert = await issue_cert(s_dict)
        await update_trust(s["creator_id"], "approved")
        # Email notification
        creator = await db.users.find_one({"id": s["creator_id"]}, {"_id": 0})
        if creator:
            asyncio.create_task(send_status_email(
                creator["email"], creator["name"], s["title"], "approved", d.notes,
                cert.get("verification_id", "")))
    elif d.decision == "rejected":
        await update_trust(s["creator_id"], "rejected")
        creator = await db.users.find_one({"id": s["creator_id"]}, {"_id": 0})
        if creator:
            asyncio.create_task(send_status_email(
                creator["email"], creator["name"], s["title"], "rejected", d.notes))
    elif d.decision == "revision_requested":
        creator = await db.users.find_one({"id": s["creator_id"]}, {"_id": 0})
        if creator:
            asyncio.create_task(send_status_email(
                creator["email"], creator["name"], s["title"], "revision_requested", d.notes))

    return {"message": f"Submission {d.decision}", "submission_id": sid}

# CERTIFICATES
@r.get("/certificates/{cid}")
async def get_cert(cid: str):
    c = await db.certificates.find_one({"id": cid}, {"_id": 0})
    if not c: raise HTTPException(404, "Certificate not found")
    return c

@r.get("/verify/{vid}")
async def verify(vid: str):
    c = await db.certificates.find_one({"verification_id": vid}, {"_id": 0})
    if not c: raise HTTPException(404, "Verification ID not found")
    return {
        "valid": c["status"] == "active", "verification_id": vid,
        "status": c["status"], "creator_name": c.get("creator_name"),
        "content_title": c.get("content_title"), "content_hash": c.get("content_hash"),
        "timestamp": c.get("timestamp"), "revoked_at": c.get("revoked_at"),
        "revocation_reason": c.get("revocation_reason"), "signature": c.get("signature")
    }

# REGISTRY
@r.get("/registry")
async def registry(
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50)
):
    q = {"status": "active"}
    if search:
        q["$or"] = [
            {"content_title": {"$regex": search, "$options": "i"}},
            {"creator_name": {"$regex": search, "$options": "i"}}
        ]
    skip = (page - 1) * limit
    certs = await db.certificates.find(q, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.certificates.count_documents(q)
    return {"certificates": certs, "total": total, "page": page, "pages": (total + limit - 1) // limit}

@r.get("/registry/stats")
async def reg_stats():
    return {
        "total_certificates": await db.certificates.count_documents({"status": "active"}),
        "total_creators": await db.users.count_documents({"role": "creator"}),
        "total_submissions": await db.submissions.count_documents({}),
        "pending_review": await db.submissions.count_documents({"status": "pending"}),
        "revoked": await db.certificates.count_documents({"status": "revoked"})
    }

# DASHBOARD
@r.get("/dashboard/stats")
async def dash_stats(u=Depends(current_user)):
    uid = u["id"]
    return {
        "total": await db.submissions.count_documents({"creator_id": uid}),
        "approved": await db.submissions.count_documents({"creator_id": uid, "status": "approved"}),
        "pending": await db.submissions.count_documents(
            {"creator_id": uid, "status": {"$in": ["pending", "revision_requested"]}}),
        "rejected": await db.submissions.count_documents({"creator_id": uid, "status": "rejected"}),
        "flagged": await db.submissions.count_documents({"creator_id": uid, "status": "flagged"}),
        "trust_score": u.get("trust_score", 50),
        "trust_level": tl(u.get("trust_score", 50)),
        "verified_posts": u.get("verified_posts", 0),
        "rejected_posts": u.get("rejected_posts", 0)
    }

# ADMIN
@r.get("/admin/users")
async def get_users(u=Depends(admin_only)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(200)
    for usr in users:
        usr["trust_level"] = tl(usr.get("trust_score", 50))
    return users

@r.post("/admin/revoke/{cid}")
async def revoke(cid: str, req: RevocationReq, u=Depends(reviewer_only)):
    c = await db.certificates.find_one({"id": cid})
    if not c: raise HTTPException(404, "Certificate not found")
    await db.certificates.update_one({"id": cid}, {"$set": {
        "status": "revoked",
        "revoked_at": datetime.now(timezone.utc).isoformat(),
        "revocation_reason": req.reason
    }})
    await db.submissions.update_one({"id": c["submission_id"]}, {"$set": {"status": "flagged"}})
    await update_trust(c["creator_id"], "fraud")
    return {"message": "Certificate revoked"}

@r.get("/creators/{uid}/profile")
async def creator_profile(uid: str):
    u = await db.users.find_one({"id": uid}, {"_id": 0, "password_hash": 0})
    if not u: raise HTTPException(404, "Creator not found")
    u["trust_level"] = tl(u.get("trust_score", 50))
    certs = await db.certificates.find({"creator_id": uid, "status": "active"}, {"_id": 0}).to_list(20)
    return {"creator": u, "certificates": certs, "certificate_count": len(certs)}

@r.post("/seed")
async def seed_demo():
    count = await db.users.count_documents({})
    if count > 0:
        return {"message": "Already seeded"}
    users = [
        {"id": str(uuid.uuid4()), "name": "Admin User", "email": "admin@vhccs.com",
         "password_hash": hash_pw("admin123"), "role": "admin", "trust_score": 100,
         "verified_posts": 0, "rejected_posts": 0, "identity_verified": True, "status": "active",
         "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "name": "Reviewer Jane", "email": "reviewer@vhccs.com",
         "password_hash": hash_pw("review123"), "role": "reviewer", "trust_score": 85,
         "verified_posts": 0, "rejected_posts": 0, "identity_verified": True, "status": "active",
         "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "name": "Creator Alice", "email": "creator@vhccs.com",
         "password_hash": hash_pw("creator123"), "role": "creator", "trust_score": 50,
         "verified_posts": 0, "rejected_posts": 0, "identity_verified": False, "status": "active",
         "created_at": datetime.now(timezone.utc).isoformat()}
    ]
    await db.users.insert_many(users)
    return {"message": "Demo accounts created", "accounts": [
        {"email": "admin@vhccs.com", "password": "admin123", "role": "admin"},
        {"email": "reviewer@vhccs.com", "password": "review123", "role": "reviewer"},
        {"email": "creator@vhccs.com", "password": "creator123", "role": "creator"}
    ]}

# CERTIFICATE PDF DOWNLOAD
@r.get("/certificates/{cid}/pdf")
async def cert_pdf(cid: str):
    c = await db.certificates.find_one({"id": cid}, {"_id": 0})
    if not c: raise HTTPException(404, "Certificate not found")
    pdf_bytes = await asyncio.to_thread(build_cert_pdf, c)
    vid = c.get("verification_id", "certificate")
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="TrustInk-{vid}.pdf"'}
    )

# API KEY SYSTEM
@r.post("/apikeys")
async def create_api_key(d: APIKeyCreate, u=Depends(current_user)):
    count = await db.api_keys.count_documents({"owner_id": u["id"], "is_active": True})
    if count >= 10:
        raise HTTPException(400, "Maximum 10 active API keys allowed")
    key_value = f"vhk_{secrets.token_hex(24)}"
    key_doc = {
        "id": str(uuid.uuid4()),
        "key_value": key_value,
        "name": d.name,
        "owner_id": u["id"],
        "owner_name": u["name"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_used_at": None,
        "is_active": True,
        "usage_count": 0
    }
    await db.api_keys.insert_one(key_doc.copy())
    key_doc.pop("_id", None)
    return key_doc

@r.get("/apikeys")
async def list_api_keys(u=Depends(current_user)):
    keys = await db.api_keys.find({"owner_id": u["id"]}, {"_id": 0}).sort("created_at", -1).to_list(20)
    # Mask key after first 12 chars
    for k in keys:
        kv = k.get("key_value", "")
        k["key_preview"] = kv[:16] + "..." + kv[-4:] if len(kv) > 20 else kv
    return keys

@r.delete("/apikeys/{key_id}")
async def delete_api_key(key_id: str, u=Depends(current_user)):
    k = await db.api_keys.find_one({"id": key_id})
    if not k: raise HTTPException(404, "Key not found")
    if k["owner_id"] != u["id"] and u["role"] != "admin":
        raise HTTPException(403, "Access denied")
    await db.api_keys.update_one({"id": key_id}, {"$set": {"is_active": False}})
    return {"message": "API key revoked"}

# THIRD-PARTY VALIDATION ENDPOINT (requires API key)
@r.get("/v1/verify/{vid}")
async def third_party_verify(vid: str, x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
                              api_key: Optional[str] = Query(None)):
    raw_key = x_api_key or api_key
    if not raw_key:
        raise HTTPException(401, "API key required. Pass via X-API-Key header or ?api_key= query param")
    k = await db.api_keys.find_one({"key_value": raw_key, "is_active": True})
    if not k:
        raise HTTPException(403, "Invalid or revoked API key")
    # Track usage
    await db.api_keys.update_one({"key_value": raw_key}, {
        "$set": {"last_used_at": datetime.now(timezone.utc).isoformat()},
        "$inc": {"usage_count": 1}
    })
    c = await db.certificates.find_one({"verification_id": vid}, {"_id": 0})
    if not c: raise HTTPException(404, "Verification ID not found")
    return {
        "valid": c["status"] == "active", "verification_id": vid,
        "status": c["status"], "creator_name": c.get("creator_name"),
        "content_title": c.get("content_title"), "content_hash": c.get("content_hash"),
        "timestamp": c.get("timestamp"), "issued_by": "TrustInk",
        "api_version": "v1"
    }

# ADMIN USER MANAGEMENT
@r.post("/admin/users/{uid}/status")
async def update_user_status(uid: str, d: UserStatusUpdate, u=Depends(admin_only)):
    if d.status not in ["active", "suspended", "banned"]:
        raise HTTPException(400, "Invalid status")
    if uid == u["id"]:
        raise HTTPException(400, "Cannot change your own account status")
    target = await db.users.find_one({"id": uid})
    if not target: raise HTTPException(404, "User not found")
    await db.users.update_one({"id": uid}, {"$set": {"status": d.status}})
    return {"message": f"User status updated to {d.status}", "user_id": uid}

@r.put("/admin/users/{uid}/trust")
async def update_user_trust(uid: str, d: TrustScoreUpdate, u=Depends(admin_only)):
    if not (0 <= d.trust_score <= 100):
        raise HTTPException(400, "Trust score must be 0-100")
    await db.users.update_one({"id": uid}, {"$set": {"trust_score": d.trust_score}})
    return {"message": "Trust score updated", "trust_score": d.trust_score, "trust_level": tl(d.trust_score)}

@r.get("/admin/stats")
async def admin_stats(u=Depends(admin_only)):
    return {
        "total_users": await db.users.count_documents({}),
        "creators": await db.users.count_documents({"role": "creator"}),
        "reviewers": await db.users.count_documents({"role": "reviewer"}),
        "suspended": await db.users.count_documents({"status": "suspended"}),
        "banned": await db.users.count_documents({"status": "banned"}),
        "total_submissions": await db.submissions.count_documents({}),
        "total_certificates": await db.certificates.count_documents({"status": "active"}),
        "pending_review": await db.submissions.count_documents({"status": "pending"}),
        "api_keys_active": await db.api_keys.count_documents({"is_active": True}),
    }

app.include_router(r)

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id")
    await db.submissions.create_index("id")
    await db.submissions.create_index("creator_id")
    await db.submissions.create_index("status")
    await db.certificates.create_index("verification_id", unique=True)
    await db.certificates.create_index("id")
    await db.api_keys.create_index("key_value", unique=True)
    await db.api_keys.create_index("owner_id")
    logger.info("TrustInk API started")

@app.on_event("shutdown")
async def shutdown():
    client.close()
