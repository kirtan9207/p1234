"""Tests for new VHCCS features: Admin Panel, API Keys, PDF Certificates, Third-party verify"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://content-cert.preview.emergentagent.com').rstrip('/')

ADMIN_CREDS = {"email": "admin@vhccs.com", "password": "admin123"}
CREATOR_CREDS = {"email": "creator@vhccs.com", "password": "creator123"}
REVIEWER_CREDS = {"email": "reviewer@vhccs.com", "password": "review123"}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    return r.json()["token"]

@pytest.fixture(scope="module")
def creator_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=CREATOR_CREDS)
    assert r.status_code == 200, f"Creator login failed: {r.text}"
    return r.json()["token"]

@pytest.fixture(scope="module")
def reviewer_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=REVIEWER_CREDS)
    assert r.status_code == 200, f"Reviewer login failed: {r.text}"
    return r.json()["token"]

def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ─── ADMIN ENDPOINTS ────────────────────────────────────────

class TestAdminStats:
    """GET /api/admin/stats"""
    def test_admin_can_get_stats(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/stats", headers=auth_headers(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert "total_users" in data
        assert "api_keys_active" in data
        assert "total_certificates" in data
        assert isinstance(data["api_keys_active"], int)

    def test_creator_cannot_get_stats(self, creator_token):
        r = requests.get(f"{BASE_URL}/api/admin/stats", headers=auth_headers(creator_token))
        assert r.status_code == 403

    def test_no_auth_fails(self):
        r = requests.get(f"{BASE_URL}/api/admin/stats")
        assert r.status_code in [401, 403]


class TestAdminUsers:
    """GET /api/admin/users"""
    def test_admin_list_users(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/users", headers=auth_headers(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Check structure
        user = data[0]
        assert "id" in user
        assert "email" in user
        assert "role" in user
        assert "trust_score" in user
        assert "password_hash" not in user  # password_hash should be excluded

    def test_creator_cannot_list_users(self, creator_token):
        r = requests.get(f"{BASE_URL}/api/admin/users", headers=auth_headers(creator_token))
        assert r.status_code == 403


class TestAdminUserStatus:
    """POST /api/admin/users/{uid}/status"""
    def test_suspend_and_reactivate_user(self, admin_token):
        # Get creator user id
        r = requests.get(f"{BASE_URL}/api/admin/users", headers=auth_headers(admin_token))
        assert r.status_code == 200
        users = r.json()
        creator = next((u for u in users if u["email"] == "creator@vhccs.com"), None)
        assert creator is not None
        uid = creator["id"]

        # Suspend
        r = requests.post(f"{BASE_URL}/api/admin/users/{uid}/status",
                          json={"status": "suspended"}, headers=auth_headers(admin_token))
        assert r.status_code == 200
        assert "suspended" in r.json()["message"]

        # Re-activate
        r = requests.post(f"{BASE_URL}/api/admin/users/{uid}/status",
                          json={"status": "active"}, headers=auth_headers(admin_token))
        assert r.status_code == 200
        assert "active" in r.json()["message"]

    def test_invalid_status_fails(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/users", headers=auth_headers(admin_token))
        uid = r.json()[0]["id"]
        r = requests.post(f"{BASE_URL}/api/admin/users/{uid}/status",
                          json={"status": "invalid_status"}, headers=auth_headers(admin_token))
        assert r.status_code == 400

    def test_creator_cannot_update_status(self, creator_token, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/users", headers=auth_headers(admin_token))
        uid = r.json()[0]["id"]
        r = requests.post(f"{BASE_URL}/api/admin/users/{uid}/status",
                          json={"status": "suspended"}, headers=auth_headers(creator_token))
        assert r.status_code == 403


class TestAdminTrustScore:
    """PUT /api/admin/users/{uid}/trust"""
    def test_update_trust_score(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/users", headers=auth_headers(admin_token))
        users = r.json()
        creator = next((u for u in users if u["email"] == "creator@vhccs.com"), None)
        uid = creator["id"]
        original_score = creator["trust_score"]

        # Set to 75
        r = requests.put(f"{BASE_URL}/api/admin/users/{uid}/trust",
                         json={"trust_score": 75}, headers=auth_headers(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert data["trust_score"] == 75
        assert "trust_level" in data

        # Restore
        requests.put(f"{BASE_URL}/api/admin/users/{uid}/trust",
                     json={"trust_score": original_score}, headers=auth_headers(admin_token))

    def test_invalid_trust_score_out_of_range(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/users", headers=auth_headers(admin_token))
        uid = r.json()[0]["id"]
        r = requests.put(f"{BASE_URL}/api/admin/users/{uid}/trust",
                         json={"trust_score": 150}, headers=auth_headers(admin_token))
        assert r.status_code == 400


# ─── API KEY ENDPOINTS ────────────────────────────────────────

class TestAPIKeys:
    """POST/GET/DELETE /api/apikeys"""
    created_key_id = None
    created_key_value = None

    def test_create_api_key(self, creator_token):
        r = requests.post(f"{BASE_URL}/api/apikeys",
                          json={"name": "TEST_integration_key"},
                          headers=auth_headers(creator_token))
        assert r.status_code == 200
        data = r.json()
        assert "id" in data
        assert "key_value" in data
        assert data["key_value"].startswith("vhk_")
        assert len(data["key_value"]) > 10
        assert data["name"] == "TEST_integration_key"
        assert data["is_active"] is True
        TestAPIKeys.created_key_id = data["id"]
        TestAPIKeys.created_key_value = data["key_value"]

    def test_list_api_keys(self, creator_token):
        r = requests.get(f"{BASE_URL}/api/apikeys", headers=auth_headers(creator_token))
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # Find our created key
        key = next((k for k in data if k.get("name") == "TEST_integration_key"), None)
        assert key is not None
        assert "key_preview" in key  # Should be masked

    def test_third_party_verify_with_api_key(self, creator_token):
        if not TestAPIKeys.created_key_value:
            pytest.skip("API key not created")
        # Need a valid verification ID - get from registry
        r = requests.get(f"{BASE_URL}/api/registry")
        if r.status_code == 200 and r.json().get("certificates"):
            vid = r.json()["certificates"][0]["verification_id"]
            # Test with query param
            r2 = requests.get(f"{BASE_URL}/api/v1/verify/{vid}",
                              params={"api_key": TestAPIKeys.created_key_value})
            assert r2.status_code == 200
            data = r2.json()
            assert "valid" in data
            assert "api_version" in data
            assert data["api_version"] == "v1"

    def test_third_party_verify_requires_api_key(self):
        r = requests.get(f"{BASE_URL}/api/v1/verify/VH-2026-XXXXXX")
        assert r.status_code == 401

    def test_third_party_verify_invalid_key(self):
        r = requests.get(f"{BASE_URL}/api/v1/verify/VH-2026-XXXXXX",
                         headers={"X-API-Key": "vhk_invalid_key_value"})
        assert r.status_code == 403

    def test_delete_api_key(self, creator_token):
        if not TestAPIKeys.created_key_id:
            pytest.skip("API key not created")
        r = requests.delete(f"{BASE_URL}/api/apikeys/{TestAPIKeys.created_key_id}",
                            headers=auth_headers(creator_token))
        assert r.status_code == 200
        assert "revoked" in r.json()["message"].lower()

    def test_revoked_key_cannot_be_used(self):
        if not TestAPIKeys.created_key_value:
            pytest.skip("API key not created")
        r = requests.get(f"{BASE_URL}/api/v1/verify/VH-2026-XXXXXX",
                         params={"api_key": TestAPIKeys.created_key_value})
        assert r.status_code == 403


# ─── PDF CERTIFICATE ────────────────────────────────────────

class TestPDFCertificate:
    """GET /api/certificates/{cid}/pdf"""
    def test_pdf_returns_valid_content(self):
        # Get a cert from registry
        r = requests.get(f"{BASE_URL}/api/registry")
        if r.status_code != 200 or not r.json().get("certificates"):
            pytest.skip("No certificates in registry")
        cert = r.json()["certificates"][0]
        cid = cert["id"]

        r2 = requests.get(f"{BASE_URL}/api/certificates/{cid}/pdf")
        assert r2.status_code == 200
        assert r2.headers.get("content-type", "").startswith("application/pdf")
        # Verify PDF magic bytes
        assert r2.content[:4] == b"%PDF"
        assert len(r2.content) > 1000  # Non-trivial PDF

    def test_pdf_invalid_cert_returns_404(self):
        r = requests.get(f"{BASE_URL}/api/certificates/nonexistent-cert-id/pdf")
        assert r.status_code == 404


# ─── SUBMISSION WITH AI DETECTION ────────────────────────────

class TestSubmissionAIDetection:
    """Verify HuggingFace AI detection result in submission"""
    def test_submission_has_ai_detection_fields(self, creator_token):
        content = ("This essay explores the intricate relationship between human creativity and "
                   "artificial intelligence. As we navigate this new frontier, it's important to "
                   "consider how traditional forms of expression adapt to technological change. "
                   "The human spirit, with its unique capacity for empathy and lived experience, "
                   "brings something irreplaceable to creative works that AI cannot replicate.")
        r = requests.post(f"{BASE_URL}/api/submissions",
                          json={"title": "TEST_AI Detection Test", "content_text": content},
                          headers=auth_headers(creator_token))
        assert r.status_code == 200
        data = r.json()
        assert "ai_human_probability" in data
        assert "ai_ai_probability" in data
        assert "ai_confidence" in data
        assert isinstance(data["ai_human_probability"], float)
        assert 0 <= data["ai_human_probability"] <= 1
        # source is not returned in submission response but probability should exist
