"""Lootra backend e2e tests."""
import os
import uuid
import time
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://gaming-vault-109.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

ADMIN_EMAIL = "admin@lootra.com"
ADMIN_PASS = "Admin@12345"

# Unique per-run users to avoid collisions
RUN = uuid.uuid4().hex[:8]
SELLER = {"email": f"seller_{RUN}@test.com", "password": "Seller@12345", "username": f"sell_{RUN}"}
BUYER = {"email": f"buyer_{RUN}@test.com", "password": "Buyer@12345", "username": f"buy_{RUN}"}


def _session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def state():
    return {}


# ---------------- Health ----------------
def test_health():
    r = requests.get(f"{API}/")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# ---------------- Auth ----------------
def test_register_seller(state):
    s = _session()
    r = s.post(f"{API}/auth/register", json=SELLER)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["user"]["email"] == SELLER["email"]
    assert body["user"]["balance"] == 500.0
    assert "token" in body
    assert "access_token" in s.cookies
    state["seller_session"] = s
    state["seller_user"] = body["user"]
    state["seller_token"] = body["token"]


def test_register_buyer(state):
    s = _session()
    r = s.post(f"{API}/auth/register", json=BUYER)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["user"]["balance"] == 500.0
    state["buyer_session"] = s
    state["buyer_user"] = body["user"]
    state["buyer_token"] = body["token"]


def test_duplicate_register_rejected(state):
    r = requests.post(f"{API}/auth/register", json=SELLER)
    assert r.status_code == 400


def test_me_via_cookie(state):
    s = state["seller_session"]
    r = s.get(f"{API}/auth/me")
    assert r.status_code == 200
    assert r.json()["email"] == SELLER["email"]


def test_me_via_bearer(state):
    h = {"Authorization": f"Bearer {state['seller_token']}"}
    r = requests.get(f"{API}/auth/me", headers=h)
    assert r.status_code == 200
    assert r.json()["email"] == SELLER["email"]


def test_login_admin(state):
    s = _session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    assert r.json()["user"]["role"] == "admin"
    state["admin_session"] = s
    state["admin_token"] = r.json()["token"]


def test_refresh_token(state):
    s = state["buyer_session"]
    r = s.post(f"{API}/auth/refresh")
    assert r.status_code == 200
    assert "token" in r.json()


def test_logout(state):
    s = _session()
    s.post(f"{API}/auth/register", json={"email": f"logout_{RUN}@t.com", "password": "Passw0rd!", "username": f"lo_{RUN}"})
    r = s.post(f"{API}/auth/logout")
    assert r.status_code == 200
    r2 = s.get(f"{API}/auth/me")
    assert r2.status_code == 401


def test_brute_force_lockout():
    bad_email = f"victim_{RUN}@test.com"
    requests.post(f"{API}/auth/register", json={"email": bad_email, "password": "Realpass1!", "username": f"vic_{RUN}"})
    s = _session()
    got_429 = False
    for i in range(7):
        r = s.post(f"{API}/auth/login", json={"email": bad_email, "password": "wrongpass"})
        if r.status_code == 429:
            got_429 = True
            break
    assert got_429, "Expected 429 after 5 failed attempts"


# ---------------- Catalog ----------------
def test_catalog_games():
    r = requests.get(f"{API}/catalog/games")
    assert r.status_code == 200
    assert len(r.json()) >= 5


def test_catalog_categories():
    r = requests.get(f"{API}/catalog/categories")
    assert r.status_code == 200
    cats = r.json()
    assert any(c["id"] == "gaming" for c in cats)


# ---------------- Listings ----------------
LISTING_PAYLOAD = {
    "title": "Valorant Immortal Account 5 skins",
    "description": "High rank account ready to play with multiple skins.",
    "price": 150.0,
    "category": "gaming",
    "game": "valorant",
    "platform": "PC",
    "region": "NA",
    "rank": "Immortal",
    "level": 100,
    "account_age_years": 2.5,
    "skins_count": 5,
    "screenshots": [],
    "credentials_login": "secret_login_xyz",
    "credentials_password": "secret_pass_abc",
    "recovery_email": "rec@example.com",
}


def test_create_listing(state):
    s = state["seller_session"]
    r = s.post(f"{API}/listings", json=LISTING_PAYLOAD)
    assert r.status_code == 200, r.text
    listing = r.json()
    assert listing["status"] == "pending"
    assert listing["verified"] is False
    assert "credentials_encrypted" not in listing
    assert "_id" not in listing
    assert "secret_login_xyz" not in str(listing)
    state["listing_id"] = listing["id"]


def test_pending_listing_not_in_public_list(state):
    r = requests.get(f"{API}/listings")
    assert r.status_code == 200
    ids = [l["id"] for l in r.json()]
    assert state["listing_id"] not in ids


def test_get_listing_excludes_credentials(state):
    r = requests.get(f"{API}/listings/{state['listing_id']}")
    assert r.status_code == 200
    body = r.json()
    assert "credentials_encrypted" not in body
    assert "_id" not in body
    assert "secret_login_xyz" not in str(body)


# ---------------- Admin approve ----------------
def test_admin_list_pending(state):
    s = state["admin_session"]
    r = s.get(f"{API}/admin/listings?status=pending")
    assert r.status_code == 200
    ids = [l["id"] for l in r.json()]
    assert state["listing_id"] in ids


def test_non_admin_403(state):
    s = state["buyer_session"]
    r = s.get(f"{API}/admin/listings")
    assert r.status_code == 403


def test_admin_approve(state):
    s = state["admin_session"]
    r = s.post(f"{API}/admin/listings/{state['listing_id']}/approve")
    assert r.status_code == 200
    r2 = requests.get(f"{API}/listings/{state['listing_id']}")
    assert r2.json()["status"] == "active"
    assert r2.json()["verified"] is True


# ---------------- Escrow purchase ----------------
def test_cannot_buy_own_listing(state):
    s = state["seller_session"]
    r = s.post(f"{API}/orders/{state['listing_id']}/purchase")
    assert r.status_code == 400


def test_purchase_listing(state):
    s = state["buyer_session"]
    r = s.post(f"{API}/orders/{state['listing_id']}/purchase")
    assert r.status_code == 200, r.text
    order = r.json()
    assert order["status"] == "PAID"
    assert order["amount"] == 150.0
    assert "_id" not in order
    state["order_id"] = order["id"]
    # buyer balance debited
    me = s.get(f"{API}/auth/me").json()
    assert me["balance"] == 350.0
    # listing now sold
    l = requests.get(f"{API}/listings/{state['listing_id']}").json()
    assert l["status"] == "sold"


def test_cannot_buy_non_active(state):
    s = state["buyer_session"]
    r = s.post(f"{API}/orders/{state['listing_id']}/purchase")
    assert r.status_code == 400


def test_insufficient_balance(state):
    # poor buyer
    s = _session()
    s.post(f"{API}/auth/register", json={"email": f"poor_{RUN}@t.com", "password": "Passw0rd!", "username": f"poor_{RUN}"})
    # drain by topup negative — not possible. Create expensive listing instead
    seller = state["seller_session"]
    pricey = dict(LISTING_PAYLOAD)
    pricey["title"] = "Expensive account big big big"
    pricey["price"] = 10000.0
    lid = seller.post(f"{API}/listings", json=pricey).json()["id"]
    state["admin_session"].post(f"{API}/admin/listings/{lid}/approve")
    r = s.post(f"{API}/orders/{lid}/purchase")
    assert r.status_code == 400


# ---------------- Reveal / Confirm ----------------
def test_reveal_only_buyer(state):
    s = state["seller_session"]
    r = s.post(f"{API}/orders/{state['order_id']}/reveal")
    assert r.status_code == 403


def test_buyer_reveal(state):
    s = state["buyer_session"]
    r = s.post(f"{API}/orders/{state['order_id']}/reveal")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "DELIVERED"
    assert body["credentials"]["login"] == "secret_login_xyz"
    assert body["credentials"]["password"] == "secret_pass_abc"


def test_confirm_release(state):
    s = state["buyer_session"]
    seller_balance_before = state["admin_session"].get(f"{API}/admin/users").json()
    seller_bal_before = next(u["balance"] for u in seller_balance_before if u["id"] == state["seller_user"]["id"])
    r = s.post(f"{API}/orders/{state['order_id']}/confirm")
    assert r.status_code == 200
    o = s.get(f"{API}/orders/{state['order_id']}").json()
    assert o["status"] == "RELEASED"
    # seller balance up by 150
    users = state["admin_session"].get(f"{API}/admin/users").json()
    seller_bal_after = next(u["balance"] for u in users if u["id"] == state["seller_user"]["id"])
    assert seller_bal_after - seller_bal_before == 150.0


# ---------------- Review ----------------
def test_review(state):
    s = state["buyer_session"]
    r = s.post(f"{API}/orders/{state['order_id']}/review", json={"rating": 5, "comment": "Great seller!"})
    assert r.status_code == 200


# ---------------- Watchlist ----------------
def test_watchlist_toggle(state):
    s = state["buyer_session"]
    # Need an active listing. Create one and approve
    seller = state["seller_session"]
    lid = seller.post(f"{API}/listings", json=dict(LISTING_PAYLOAD, title="Watchlist target item")).json()["id"]
    state["admin_session"].post(f"{API}/admin/listings/{lid}/approve")
    r = s.post(f"{API}/watchlist/{lid}")
    assert r.json()["watching"] is True
    r2 = s.get(f"{API}/watchlist")
    assert any(x["id"] == lid for x in r2.json())
    r3 = s.post(f"{API}/watchlist/{lid}")
    assert r3.json()["watching"] is False
    state["watch_listing"] = lid


# ---------------- Dispute & Refund ----------------
def test_dispute_and_refund(state):
    # Create new listing, approve, buyer purchases, dispute, admin refund
    seller = state["seller_session"]
    lid = seller.post(f"{API}/listings", json=dict(LISTING_PAYLOAD, title="Dispute test listing here")).json()["id"]
    state["admin_session"].post(f"{API}/admin/listings/{lid}/approve")
    buyer = state["buyer_session"]
    bal_before = buyer.get(f"{API}/auth/me").json()["balance"]
    order = buyer.post(f"{API}/orders/{lid}/purchase").json()
    oid = order["id"]
    r = buyer.post(f"{API}/orders/{oid}/dispute", json={"reason": "Account didnt work properly at all"})
    assert r.status_code == 200
    o = buyer.get(f"{API}/orders/{oid}").json()
    assert o["status"] == "DISPUTED"
    # admin refund
    r2 = state["admin_session"].post(f"{API}/admin/orders/{oid}/refund")
    assert r2.status_code == 200
    o2 = buyer.get(f"{API}/orders/{oid}").json()
    assert o2["status"] == "REFUNDED"
    bal_after = buyer.get(f"{API}/auth/me").json()["balance"]
    assert bal_after == bal_before  # refunded
    # listing re-listed
    l = requests.get(f"{API}/listings/{lid}").json()
    assert l["status"] == "active"


# ---------------- Admin vault & audit & stats ----------------
def test_admin_vault(state):
    s = state["admin_session"]
    r = s.get(f"{API}/admin/vault/{state['listing_id']}")
    assert r.status_code == 200
    assert r.json()["credentials"]["login"] == "secret_login_xyz"


def test_vault_non_admin_403(state):
    s = state["buyer_session"]
    r = s.get(f"{API}/admin/vault/{state['listing_id']}")
    assert r.status_code == 403


def test_admin_audit(state):
    s = state["admin_session"]
    r = s.get(f"{API}/admin/audit")
    assert r.status_code == 200
    actions = {x["action"] for x in r.json()}
    for needed in ["listing.create", "listing.approve", "order.purchase", "vault.reveal"]:
        assert needed in actions, f"missing audit action {needed}"


def test_admin_stats(state):
    s = state["admin_session"]
    r = s.get(f"{API}/admin/stats")
    assert r.status_code == 200
    for k in ["users", "listings_pending", "listings_active", "orders_total"]:
        assert k in r.json()


def test_admin_reject(state):
    seller = state["seller_session"]
    lid = seller.post(f"{API}/listings", json=dict(LISTING_PAYLOAD, title="To be rejected listing here")).json()["id"]
    r = state["admin_session"].post(f"{API}/admin/listings/{lid}/reject")
    assert r.status_code == 200
    l = requests.get(f"{API}/listings/{lid}").json()
    assert l["status"] == "rejected"
