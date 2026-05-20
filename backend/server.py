from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
import secrets
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

import bcrypt
import jwt
from cryptography.fernet import Fernet
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field, ConfigDict

# ---------------- Config ----------------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
VAULT_KEY = os.environ["VAULT_KEY"].encode()
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@lootra.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin@12345")
SIGNUP_BONUS = float(os.environ.get("SIGNUP_BONUS", "500"))
JWT_ALG = "HS256"

fernet = Fernet(VAULT_KEY)

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Lootra API")
api = APIRouter(prefix="/api")

# ---------------- Logging ----------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
log = logging.getLogger("lootra")

# ---------------- Helpers ----------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)

def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def make_access_token(uid: str, email: str, role: str) -> str:
    payload = {"sub": uid, "email": email, "role": role,
               "exp": now_utc() + timedelta(hours=12), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def make_refresh_token(uid: str) -> str:
    payload = {"sub": uid, "exp": now_utc() + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def set_auth_cookies(resp: Response, access: str, refresh: str):
    resp.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=43200, path="/")
    resp.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none", max_age=604800, path="/")

def clear_auth_cookies(resp: Response):
    resp.delete_cookie("access_token", path="/")
    resp.delete_cookie("refresh_token", path="/")

def sanitize_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "email": u["email"],
        "username": u.get("username", ""),
        "role": u.get("role", "user"),
        "balance": u.get("balance", 0.0),
        "trust_score": u.get("trust_score", 0),
        "sales_count": u.get("sales_count", 0),
        "is_verified_seller": u.get("is_verified_seller", False),
        "created_at": u.get("created_at"),
    }

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        ah = request.headers.get("Authorization", "")
        if ah.startswith("Bearer "):
            token = ah[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

def encrypt_text(plain: str) -> str:
    return fernet.encrypt(plain.encode()).decode()

def decrypt_text(cipher: str) -> str:
    return fernet.decrypt(cipher.encode()).decode()

async def audit(action: str, user_id: Optional[str], target: str, meta: Optional[dict] = None):
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "action": action,
        "user_id": user_id,
        "target": target,
        "meta": meta or {},
        "created_at": now_utc().isoformat(),
    })

# ---------------- Schemas ----------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    username: str = Field(min_length=3, max_length=30)

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class ListingCreate(BaseModel):
    title: str = Field(min_length=5, max_length=120)
    description: str = Field(min_length=10, max_length=4000)
    price: float = Field(gt=0)
    category: str  # gaming|social|streaming|subscription
    game: str
    platform: str  # PC|PS|Xbox|Mobile|Switch
    region: str
    rank: Optional[str] = ""
    level: Optional[int] = 0
    account_age_years: Optional[float] = 0
    skins_count: Optional[int] = 0
    screenshots: List[str] = []
    credentials_login: str
    credentials_password: str
    recovery_email: Optional[str] = ""
    backup_codes: Optional[str] = ""

class ListingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None

class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str = Field(max_length=1000)

class DisputeIn(BaseModel):
    reason: str = Field(min_length=10, max_length=1000)

# ---------------- Startup ----------------
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.listings.create_index("id", unique=True)
    await db.listings.create_index([("status", 1), ("created_at", -1)])
    await db.orders.create_index("id", unique=True)
    await db.login_attempts.create_index("identifier")
    # Seed admin
    existing = await db.users.find_one({"email": ADMIN_EMAIL})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": ADMIN_EMAIL,
            "username": "admin",
            "password_hash": hash_pw(ADMIN_PASSWORD),
            "role": "admin",
            "balance": 0.0,
            "trust_score": 100,
            "sales_count": 0,
            "is_verified_seller": True,
            "created_at": now_utc().isoformat(),
        })
        log.info(f"Seeded admin: {ADMIN_EMAIL}")
    # Seed categories/games
    if await db.categories.count_documents({}) == 0:
        await db.categories.insert_many([
            {"id": "gaming", "name": "Gaming Accounts", "active": True},
            {"id": "social", "name": "Social Media", "active": False},
            {"id": "streaming", "name": "Streaming", "active": False},
            {"id": "subscription", "name": "Subscriptions", "active": False},
        ])
    if await db.games.count_documents({}) == 0:
        await db.games.insert_many([
            {"id": "valorant", "name": "Valorant", "platform": "PC"},
            {"id": "lol", "name": "League of Legends", "platform": "PC"},
            {"id": "csgo", "name": "CS2", "platform": "PC"},
            {"id": "fortnite", "name": "Fortnite", "platform": "PC"},
            {"id": "apex", "name": "Apex Legends", "platform": "PC"},
            {"id": "cod", "name": "Call of Duty", "platform": "PC"},
            {"id": "wow", "name": "World of Warcraft", "platform": "PC"},
            {"id": "genshin", "name": "Genshin Impact", "platform": "Mobile"},
            {"id": "pubg", "name": "PUBG", "platform": "PC"},
            {"id": "rocketleague", "name": "Rocket League", "platform": "PC"},
        ])

# ---------------- Auth ----------------
@api.post("/auth/register")
async def register(data: RegisterIn, response: Response):
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    if await db.users.find_one({"username": data.username}):
        raise HTTPException(status_code=400, detail="Username taken")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid,
        "email": email,
        "username": data.username,
        "password_hash": hash_pw(data.password),
        "role": "user",
        "balance": SIGNUP_BONUS,
        "trust_score": 50,
        "sales_count": 0,
        "is_verified_seller": False,
        "created_at": now_utc().isoformat(),
    }
    await db.users.insert_one(doc)
    access = make_access_token(uid, email, "user")
    refresh = make_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    await audit("register", uid, "user", {"email": email})
    return {"user": sanitize_user(doc), "token": access}

@api.post("/auth/login")
async def login(data: LoginIn, request: Request, response: Response):
    email = data.email.lower()
    ip = request.client.host if request.client else "unknown"
    key = f"{ip}:{email}"
    rec = await db.login_attempts.find_one({"identifier": key})
    if rec and rec.get("locked_until") and datetime.fromisoformat(rec["locked_until"]) > now_utc():
        raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")
    user = await db.users.find_one({"email": email})
    if not user or not verify_pw(data.password, user["password_hash"]):
        attempts = (rec or {}).get("attempts", 0) + 1
        update = {"attempts": attempts, "last_at": now_utc().isoformat()}
        if attempts >= 5:
            update["locked_until"] = (now_utc() + timedelta(minutes=15)).isoformat()
            update["attempts"] = 0
        await db.login_attempts.update_one({"identifier": key}, {"$set": update}, upsert=True)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    await db.login_attempts.delete_one({"identifier": key})
    access = make_access_token(user["id"], user["email"], user.get("role", "user"))
    refresh = make_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    return {"user": sanitize_user(user), "token": access}

@api.post("/auth/logout")
async def logout(response: Response):
    clear_auth_cookies(response)
    return {"ok": True}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    # refresh user data
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return sanitize_user(u)

@api.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        access = make_access_token(user["id"], user["email"], user.get("role", "user"))
        response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=43200, path="/")
        return {"token": access}
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ---------------- Catalog ----------------
@api.get("/catalog/games")
async def list_games():
    return await db.games.find({}, {"_id": 0}).to_list(200)

@api.get("/catalog/categories")
async def list_categories():
    return await db.categories.find({}, {"_id": 0}).to_list(50)

# ---------------- Listings ----------------
@api.post("/listings")
async def create_listing(data: ListingCreate, user: dict = Depends(get_current_user)):
    lid = str(uuid.uuid4())
    cred_blob = {
        "login": data.credentials_login,
        "password": data.credentials_password,
        "recovery_email": data.recovery_email or "",
        "backup_codes": data.backup_codes or "",
    }
    import json as _json
    encrypted = encrypt_text(_json.dumps(cred_blob))
    doc = {
        "id": lid,
        "seller_id": user["id"],
        "seller_username": user["username"],
        "title": data.title,
        "description": data.description,
        "price": data.price,
        "category": data.category,
        "game": data.game,
        "platform": data.platform,
        "region": data.region,
        "rank": data.rank or "",
        "level": data.level or 0,
        "account_age_years": data.account_age_years or 0,
        "skins_count": data.skins_count or 0,
        "screenshots": data.screenshots[:8],
        "credentials_encrypted": encrypted,
        "status": "pending",  # pending|active|sold|rejected
        "verified": False,
        "views": 0,
        "created_at": now_utc().isoformat(),
        "updated_at": now_utc().isoformat(),
    }
    await db.listings.insert_one(doc)
    await audit("listing.create", user["id"], lid)
    doc.pop("credentials_encrypted", None)
    doc.pop("_id", None)
    return doc

@api.get("/listings")
async def get_listings(
    q: Optional[str] = None,
    game: Optional[str] = None,
    platform: Optional[str] = None,
    region: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    verified: Optional[bool] = None,
    sort: Optional[str] = "newest",
    limit: int = 50,
):
    flt = {"status": "active"}
    if q:
        flt["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
            {"game": {"$regex": q, "$options": "i"}},
        ]
    if game: flt["game"] = game
    if platform: flt["platform"] = platform
    if region: flt["region"] = region
    if verified is not None: flt["verified"] = verified
    price_q = {}
    if min_price is not None: price_q["$gte"] = min_price
    if max_price is not None: price_q["$lte"] = max_price
    if price_q: flt["price"] = price_q

    sort_spec = [("created_at", -1)]
    if sort == "price_asc": sort_spec = [("price", 1)]
    elif sort == "price_desc": sort_spec = [("price", -1)]

    cursor = db.listings.find(flt, {"_id": 0, "credentials_encrypted": 0}).sort(sort_spec).limit(min(limit, 100))
    return await cursor.to_list(limit)

@api.get("/listings/{listing_id}")
async def get_listing(listing_id: str):
    l = await db.listings.find_one({"id": listing_id}, {"_id": 0, "credentials_encrypted": 0})
    if not l:
        raise HTTPException(404, "Listing not found")
    await db.listings.update_one({"id": listing_id}, {"$inc": {"views": 1}})
    return l

@api.get("/listings/mine/all")
async def my_listings(user: dict = Depends(get_current_user)):
    cursor = db.listings.find({"seller_id": user["id"]}, {"_id": 0, "credentials_encrypted": 0}).sort([("created_at", -1)])
    return await cursor.to_list(200)

@api.delete("/listings/{listing_id}")
async def delete_listing(listing_id: str, user: dict = Depends(get_current_user)):
    l = await db.listings.find_one({"id": listing_id})
    if not l:
        raise HTTPException(404, "Not found")
    if l["seller_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(403, "Forbidden")
    if l["status"] in ("sold",):
        raise HTTPException(400, "Cannot delete a sold listing")
    await db.listings.delete_one({"id": listing_id})
    return {"ok": True}

# ---------------- Watchlist ----------------
@api.post("/watchlist/{listing_id}")
async def toggle_watch(listing_id: str, user: dict = Depends(get_current_user)):
    existing = await db.watchlist.find_one({"user_id": user["id"], "listing_id": listing_id})
    if existing:
        await db.watchlist.delete_one({"_id": existing["_id"]})
        return {"watching": False}
    await db.watchlist.insert_one({"user_id": user["id"], "listing_id": listing_id, "created_at": now_utc().isoformat()})
    return {"watching": True}

@api.get("/watchlist")
async def get_watchlist(user: dict = Depends(get_current_user)):
    items = await db.watchlist.find({"user_id": user["id"]}, {"_id": 0}).to_list(200)
    ids = [i["listing_id"] for i in items]
    listings = await db.listings.find({"id": {"$in": ids}}, {"_id": 0, "credentials_encrypted": 0}).to_list(200)
    return listings

# ---------------- Orders / Escrow ----------------
# Lifecycle: PENDING -> PAID (funds held) -> DELIVERED (admin released creds) -> CONFIRMED (buyer ok) -> RELEASED (seller paid)
# OR -> DISPUTED -> REFUNDED
@api.post("/orders/{listing_id}/purchase")
async def purchase(listing_id: str, user: dict = Depends(get_current_user)):
    listing = await db.listings.find_one({"id": listing_id})
    if not listing:
        raise HTTPException(404, "Listing not found")
    if listing["status"] != "active":
        raise HTTPException(400, "Listing not available")
    if listing["seller_id"] == user["id"]:
        raise HTTPException(400, "Cannot buy your own listing")
    if user.get("balance", 0) < listing["price"]:
        raise HTTPException(400, "Insufficient balance. Top up your wallet.")
    oid = str(uuid.uuid4())
    # Debit buyer, hold in escrow
    await db.users.update_one({"id": user["id"]}, {"$inc": {"balance": -listing["price"]}})
    await db.listings.update_one({"id": listing_id}, {"$set": {"status": "sold", "updated_at": now_utc().isoformat()}})
    order = {
        "id": oid,
        "listing_id": listing_id,
        "listing_snapshot": {k: listing[k] for k in ["title", "game", "platform", "price", "screenshots", "region"]},
        "buyer_id": user["id"],
        "buyer_username": user["username"],
        "seller_id": listing["seller_id"],
        "seller_username": listing["seller_username"],
        "amount": listing["price"],
        "status": "PAID",  # PAID -> DELIVERED -> CONFIRMED -> RELEASED ; or DISPUTED -> REFUNDED
        "credentials_released": False,
        "created_at": now_utc().isoformat(),
        "updated_at": now_utc().isoformat(),
        "timeline": [{"status": "PAID", "at": now_utc().isoformat(), "note": "Funds held in escrow."}],
    }
    await db.orders.insert_one(order)
    await audit("order.purchase", user["id"], oid, {"amount": listing["price"]})
    order.pop("_id", None)
    return order

@api.get("/orders/mine")
async def my_orders(role: str = Query("buyer"), user: dict = Depends(get_current_user)):
    fld = "buyer_id" if role == "buyer" else "seller_id"
    cursor = db.orders.find({fld: user["id"]}, {"_id": 0}).sort([("created_at", -1)])
    return await cursor.to_list(200)

@api.get("/orders/{order_id}")
async def get_order(order_id: str, user: dict = Depends(get_current_user)):
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found")
    if user["id"] not in (o["buyer_id"], o["seller_id"]) and user.get("role") != "admin":
        raise HTTPException(403, "Forbidden")
    return o

@api.post("/orders/{order_id}/reveal")
async def buyer_reveal(order_id: str, user: dict = Depends(get_current_user)):
    """Buyer reveals credentials once admin has delivered them (status DELIVERED).
    For simplicity in MVP we allow auto-delivery: PAID -> DELIVERED on first reveal request.
    Returns decrypted credentials."""
    o = await db.orders.find_one({"id": order_id})
    if not o:
        raise HTTPException(404, "Order not found")
    if o["buyer_id"] != user["id"]:
        raise HTTPException(403, "Only buyer can reveal credentials")
    if o["status"] in ("REFUNDED",):
        raise HTTPException(400, "Order not eligible")
    listing = await db.listings.find_one({"id": o["listing_id"]})
    if not listing or not listing.get("credentials_encrypted"):
        raise HTTPException(404, "Credentials unavailable")
    import json as _json
    creds = _json.loads(decrypt_text(listing["credentials_encrypted"]))
    new_status = o["status"]
    timeline = o.get("timeline", [])
    if o["status"] == "PAID":
        new_status = "DELIVERED"
        timeline.append({"status": "DELIVERED", "at": now_utc().isoformat(), "note": "Credentials revealed to buyer."})
        await db.orders.update_one({"id": order_id}, {"$set": {
            "status": new_status, "credentials_released": True,
            "timeline": timeline, "updated_at": now_utc().isoformat(),
        }})
    await audit("order.reveal", user["id"], order_id)
    return {"credentials": creds, "status": new_status}

@api.post("/orders/{order_id}/confirm")
async def confirm_order(order_id: str, user: dict = Depends(get_current_user)):
    o = await db.orders.find_one({"id": order_id})
    if not o or o["buyer_id"] != user["id"]:
        raise HTTPException(403, "Forbidden")
    if o["status"] != "DELIVERED":
        raise HTTPException(400, "Order not ready to confirm")
    timeline = o.get("timeline", [])
    timeline.append({"status": "CONFIRMED", "at": now_utc().isoformat(), "note": "Buyer confirmed access."})
    timeline.append({"status": "RELEASED", "at": now_utc().isoformat(), "note": "Funds released to seller."})
    await db.orders.update_one({"id": order_id}, {"$set": {
        "status": "RELEASED", "timeline": timeline, "updated_at": now_utc().isoformat(),
    }})
    await db.users.update_one({"id": o["seller_id"]}, {"$inc": {"balance": o["amount"], "sales_count": 1, "trust_score": 2}})
    await audit("order.released", user["id"], order_id, {"amount": o["amount"]})
    return {"ok": True}

@api.post("/orders/{order_id}/dispute")
async def dispute_order(order_id: str, body: DisputeIn, user: dict = Depends(get_current_user)):
    o = await db.orders.find_one({"id": order_id})
    if not o or user["id"] not in (o["buyer_id"], o["seller_id"]):
        raise HTTPException(403, "Forbidden")
    if o["status"] in ("RELEASED", "REFUNDED"):
        raise HTTPException(400, "Order already finalized")
    timeline = o.get("timeline", [])
    timeline.append({"status": "DISPUTED", "at": now_utc().isoformat(), "note": f"Dispute by {user['username']}: {body.reason}"})
    await db.orders.update_one({"id": order_id}, {"$set": {
        "status": "DISPUTED", "dispute_reason": body.reason, "timeline": timeline, "updated_at": now_utc().isoformat(),
    }})
    await audit("order.disputed", user["id"], order_id)
    return {"ok": True}

@api.post("/orders/{order_id}/review")
async def review_order(order_id: str, body: ReviewIn, user: dict = Depends(get_current_user)):
    o = await db.orders.find_one({"id": order_id})
    if not o or o["buyer_id"] != user["id"]:
        raise HTTPException(403, "Forbidden")
    if o["status"] != "RELEASED":
        raise HTTPException(400, "Can only review released orders")
    if await db.reviews.find_one({"order_id": order_id}):
        raise HTTPException(400, "Already reviewed")
    rid = str(uuid.uuid4())
    await db.reviews.insert_one({
        "id": rid, "order_id": order_id, "listing_id": o["listing_id"],
        "buyer_id": user["id"], "seller_id": o["seller_id"],
        "rating": body.rating, "comment": body.comment,
        "created_at": now_utc().isoformat(),
    })
    await db.users.update_one({"id": o["seller_id"]}, {"$inc": {"trust_score": body.rating}})
    return {"ok": True, "id": rid}

@api.get("/sellers/{seller_id}/reviews")
async def seller_reviews(seller_id: str):
    return await db.reviews.find({"seller_id": seller_id}, {"_id": 0}).sort([("created_at", -1)]).to_list(100)

# ---------------- Wallet ----------------
@api.post("/wallet/topup")
async def wallet_topup(amount: float = Query(gt=0), user: dict = Depends(get_current_user)):
    """Mock topup — adds funds directly. Replace with Stripe later."""
    await db.users.update_one({"id": user["id"]}, {"$inc": {"balance": amount}})
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return {"balance": u["balance"]}

# ---------------- Admin ----------------
@api.get("/admin/stats")
async def admin_stats(_: dict = Depends(require_admin)):
    return {
        "users": await db.users.count_documents({}),
        "listings_pending": await db.listings.count_documents({"status": "pending"}),
        "listings_active": await db.listings.count_documents({"status": "active"}),
        "orders_total": await db.orders.count_documents({}),
        "orders_held": await db.orders.count_documents({"status": {"$in": ["PAID", "DELIVERED"]}}),
        "orders_disputed": await db.orders.count_documents({"status": "DISPUTED"}),
    }

@api.get("/admin/listings")
async def admin_listings(status: Optional[str] = None, _: dict = Depends(require_admin)):
    flt = {}
    if status: flt["status"] = status
    return await db.listings.find(flt, {"_id": 0, "credentials_encrypted": 0}).sort([("created_at", -1)]).to_list(500)

@api.post("/admin/listings/{listing_id}/approve")
async def admin_approve(listing_id: str, admin: dict = Depends(require_admin)):
    l = await db.listings.find_one({"id": listing_id})
    if not l:
        raise HTTPException(404, "Not found")
    if l["status"] != "pending":
        raise HTTPException(400, "Listing is not pending")
    await db.listings.update_one({"id": listing_id}, {"$set": {
        "status": "active", "verified": True, "updated_at": now_utc().isoformat(),
    }})
    await audit("listing.approve", admin["id"], listing_id)
    return {"ok": True}

@api.post("/admin/listings/{listing_id}/reject")
async def admin_reject(listing_id: str, admin: dict = Depends(require_admin)):
    await db.listings.update_one({"id": listing_id}, {"$set": {
        "status": "rejected", "updated_at": now_utc().isoformat(),
    }})
    await audit("listing.reject", admin["id"], listing_id)
    return {"ok": True}

@api.get("/admin/orders")
async def admin_orders(status: Optional[str] = None, _: dict = Depends(require_admin)):
    flt = {}
    if status: flt["status"] = status
    return await db.orders.find(flt, {"_id": 0}).sort([("created_at", -1)]).to_list(500)

@api.post("/admin/orders/{order_id}/refund")
async def admin_refund(order_id: str, admin: dict = Depends(require_admin)):
    o = await db.orders.find_one({"id": order_id})
    if not o:
        raise HTTPException(404, "Not found")
    if o["status"] in ("RELEASED", "REFUNDED"):
        raise HTTPException(400, "Order finalized")
    await db.users.update_one({"id": o["buyer_id"]}, {"$inc": {"balance": o["amount"]}})
    timeline = o.get("timeline", [])
    timeline.append({"status": "REFUNDED", "at": now_utc().isoformat(), "note": f"Admin refund by {admin['username']}"})
    await db.orders.update_one({"id": order_id}, {"$set": {
        "status": "REFUNDED", "timeline": timeline, "updated_at": now_utc().isoformat(),
    }})
    # Re-list the listing
    await db.listings.update_one({"id": o["listing_id"]}, {"$set": {"status": "active"}})
    await audit("order.refund", admin["id"], order_id, {"amount": o["amount"]})
    return {"ok": True}

@api.get("/admin/vault/{listing_id}")
async def admin_vault(listing_id: str, admin: dict = Depends(require_admin)):
    """Admin reveals encrypted credentials. Audited."""
    import json as _json
    l = await db.listings.find_one({"id": listing_id})
    if not l or not l.get("credentials_encrypted"):
        raise HTTPException(404, "No credentials")
    creds = _json.loads(decrypt_text(l["credentials_encrypted"]))
    await audit("vault.reveal", admin["id"], listing_id)
    return {"credentials": creds}

@api.get("/admin/users")
async def admin_users(_: dict = Depends(require_admin)):
    cursor = db.users.find({}, {"_id": 0, "password_hash": 0}).sort([("created_at", -1)])
    return await cursor.to_list(500)

@api.post("/admin/users/{user_id}/ban")
async def admin_ban(user_id: str, admin: dict = Depends(require_admin)):
    await db.users.update_one({"id": user_id}, {"$set": {"role": "banned"}})
    await audit("user.ban", admin["id"], user_id)
    return {"ok": True}

@api.get("/admin/audit")
async def admin_audit(limit: int = 200, _: dict = Depends(require_admin)):
    return await db.audit_logs.find({}, {"_id": 0}).sort([("created_at", -1)]).limit(limit).to_list(limit)

# ---------------- Health ----------------
@api.get("/")
async def root():
    return {"service": "lootra", "status": "ok"}

# Include router
app.include_router(api)

# CORS
_raw_origins = os.environ.get("CORS_ORIGINS", "").strip()
_origins = [o.strip() for o in _raw_origins.split(",") if o.strip() and o.strip() != "*"]
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=_origins if _origins else [],
    allow_origin_regex=r"https?://localhost(:\d+)?|https://.*\.vercel\.app",
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown():
    client.close()
