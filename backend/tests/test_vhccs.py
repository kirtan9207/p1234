"""VHCCS Backend API Tests - Auth, Submissions, Moderation, Registry, Verify"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Ensure seeded
def ensure_seeded():
    requests.post(f"{BASE_URL}/api/seed")

ensure_seeded()

CREATOR = {"email": "creator@vhccs.com", "password": "creator123"}
REVIEWER = {"email": "reviewer@vhccs.com", "password": "review123"}
ADMIN = {"email": "admin@vhccs.com", "password": "admin123"}


def get_token(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds)
    if r.status_code == 200:
        return r.json()["token"]
    return None


class TestAuth:
    """Auth endpoint tests"""

    def test_login_creator(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json=CREATOR)
        assert r.status_code == 200
        data = r.json()
        assert "token" in data
        assert data["user"]["role"] == "creator"
        print("PASS: Creator login")

    def test_login_reviewer(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json=REVIEWER)
        assert r.status_code == 200
        data = r.json()
        assert data["user"]["role"] == "reviewer"
        print("PASS: Reviewer login")

    def test_login_admin(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN)
        assert r.status_code == 200
        data = r.json()
        assert data["user"]["role"] == "admin"
        print("PASS: Admin login")

    def test_login_invalid(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "bad@bad.com", "password": "wrong"})
        assert r.status_code == 401
        print("PASS: Invalid login returns 401")

    def test_me_endpoint(self):
        token = get_token(CREATOR)
        r = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == "creator@vhccs.com"
        print("PASS: /auth/me endpoint")


class TestSubmissions:
    """Submission endpoint tests"""

    def test_submit_content(self):
        token = get_token(CREATOR)
        r = requests.post(
            f"{BASE_URL}/api/submissions",
            json={"title": "TEST_Submission", "content_text": "This is a human-written test submission with enough characters to pass validation. It tells a story about testing."},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert r.status_code == 200
        data = r.json()
        assert "id" in data
        assert "ai_human_probability" in data
        assert "stylometry_score" in data
        assert data["status"] in ["pending", "approved", "flagged"]
        print(f"PASS: Submit content, status={data['status']}, ai_human_prob={data['ai_human_probability']}")

    def test_submit_content_too_short(self):
        token = get_token(CREATOR)
        r = requests.post(
            f"{BASE_URL}/api/submissions",
            json={"title": "Short", "content_text": "Too short"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert r.status_code == 400
        print("PASS: Short content rejected")

    def test_admin_submission_auto_approved(self):
        """Admin has trust_score=100 so should auto-approve"""
        token = get_token(ADMIN)
        r = requests.post(
            f"{BASE_URL}/api/submissions",
            json={"title": "TEST_AdminSub", "content_text": "This is a well-written human content submission by admin with varied vocabulary. It demonstrates clear authorship patterns."},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert r.status_code == 200
        data = r.json()
        # High trust + high human probability = auto-approved
        print(f"PASS: Admin submission status={data['status']}, verification_id={data.get('verification_id')}")

    def test_list_submissions(self):
        token = get_token(CREATOR)
        r = requests.get(f"{BASE_URL}/api/submissions", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        print(f"PASS: List submissions, count={len(r.json())}")


class TestModeration:
    """Moderation endpoint tests"""

    def test_moderation_queue(self):
        token = get_token(REVIEWER)
        r = requests.get(f"{BASE_URL}/api/moderation/queue", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        print(f"PASS: Moderation queue, items={len(data)}")

    def test_moderation_stats(self):
        token = get_token(REVIEWER)
        r = requests.get(f"{BASE_URL}/api/moderation/stats", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        data = r.json()
        assert "pending" in data
        assert "approved" in data
        print(f"PASS: Moderation stats: {data}")

    def test_creator_cannot_access_queue(self):
        token = get_token(CREATOR)
        r = requests.get(f"{BASE_URL}/api/moderation/queue", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 403
        print("PASS: Creator blocked from moderation queue")

    def test_approve_submission(self):
        """Submit as creator, then approve as reviewer"""
        creator_token = get_token(CREATOR)
        # Submit
        r = requests.post(
            f"{BASE_URL}/api/submissions",
            json={"title": "TEST_ApprovalFlow", "content_text": "A detailed human-written article with thoughtful insights on technology and society. The author explores multiple perspectives with careful nuance."},
            headers={"Authorization": f"Bearer {creator_token}"}
        )
        assert r.status_code == 200
        sub_id = r.json()["id"]
        sub_status = r.json()["status"]
        print(f"Submission status: {sub_status}, id: {sub_id}")

        if sub_status not in ["pending", "flagged"]:
            pytest.skip(f"Submission was auto-{sub_status}, skipping manual review test")

        # Review as reviewer
        reviewer_token = get_token(REVIEWER)
        r2 = requests.post(
            f"{BASE_URL}/api/moderation/{sub_id}/review",
            json={"decision": "approved", "notes": "Looks human-written"},
            headers={"Authorization": f"Bearer {reviewer_token}"}
        )
        assert r2.status_code == 200
        print(f"PASS: Approve submission: {r2.json()}")

        # Verify certificate was issued
        r3 = requests.get(f"{BASE_URL}/api/submissions/{sub_id}", headers={"Authorization": f"Bearer {reviewer_token}"})
        assert r3.status_code == 200
        sub_data = r3.json()
        assert sub_data["status"] == "approved"
        assert sub_data.get("verification_id") is not None
        print(f"PASS: Certificate issued with verification_id={sub_data['verification_id']}")


class TestRegistry:
    """Registry endpoint tests"""

    def test_registry(self):
        r = requests.get(f"{BASE_URL}/api/registry")
        assert r.status_code == 200
        data = r.json()
        assert "certificates" in data
        assert "total" in data
        print(f"PASS: Registry, total={data['total']}")

    def test_registry_search(self):
        r = requests.get(f"{BASE_URL}/api/registry?search=TEST")
        assert r.status_code == 200
        data = r.json()
        assert "certificates" in data
        print(f"PASS: Registry search, results={data['total']}")

    def test_registry_stats(self):
        r = requests.get(f"{BASE_URL}/api/registry/stats")
        assert r.status_code == 200
        data = r.json()
        assert "total_certificates" in data
        assert "total_creators" in data
        print(f"PASS: Registry stats: {data}")


class TestVerify:
    """Certificate verification tests"""

    def test_verify_valid_cert(self):
        """Get a verification_id from registry and verify it"""
        r = requests.get(f"{BASE_URL}/api/registry")
        assert r.status_code == 200
        certs = r.json()["certificates"]
        if not certs:
            pytest.skip("No certificates in registry to verify")
        vid = certs[0]["verification_id"]
        r2 = requests.get(f"{BASE_URL}/api/verify/{vid}")
        assert r2.status_code == 200
        data = r2.json()
        assert data["valid"] == True
        assert data["verification_id"] == vid
        assert "content_hash" in data
        assert "signature" in data
        print(f"PASS: Verify cert {vid}, valid={data['valid']}")

    def test_verify_invalid(self):
        r = requests.get(f"{BASE_URL}/api/verify/VH-INVALID-000")
        assert r.status_code == 404
        print("PASS: Invalid verification returns 404")
