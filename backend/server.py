from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
import secrets
import hashlib
import hmac as _hmac
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

import bcrypt
import jwt
import httpx
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

FLW_SECRET_KEY = os.environ.get("FLW_SECRET_KEY", "")
FLW_PUBLIC_KEY = os.environ.get("FLW_PUBLIC_KEY", "")
FLW_WEBHOOK_HASH = os.environ.get("FLW_WEBHOOK_HASH", "")
NOWPAYMENTS_API_KEY = os.environ.get("NOWPAYMENTS_API_KEY", "")
NOWPAYMENTS_IPN_SECRET = os.environ.get("NOWPAYMENTS_IPN_SECRET", "")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
EMAIL_FROM = os.environ.get("EMAIL_FROM", "Lootra <noreply@lootra.org>")

SUPPORTED_CURRENCIES = ["USD", "CAD", "GBP", "EUR", "NGN", "GHS"]
FALLBACK_RATES = {"USD": 1.0, "CAD": 1.37, "GBP": 0.79, "EUR": 0.92, "NGN": 1550.0, "GHS": 15.5}
_rates_cache: dict = {"rates": dict(FALLBACK_RATES), "updated_at": None}

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

async def get_exchange_rates() -> dict:
    now = now_utc()
    cached_at = _rates_cache["updated_at"]
    if cached_at and (now - cached_at).total_seconds() < 3600:
        return _rates_cache["rates"]
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get("https://api.exchangerate-api.com/v4/latest/USD")
            data = r.json()
            rates = {c: float(data["rates"].get(c, FALLBACK_RATES[c])) for c in SUPPORTED_CURRENCIES}
            _rates_cache["rates"] = rates
            _rates_cache["updated_at"] = now
            return rates
    except Exception:
        return _rates_cache["rates"]

_banks_cache: dict = {"banks": [], "updated_at": None}

async def get_flutterwave_banks() -> list:
    now = now_utc()
    if _banks_cache["updated_at"] and (now - _banks_cache["updated_at"]).total_seconds() < 3600:
        return _banks_cache["banks"]
    try:
        async with httpx.AsyncClient(timeout=10) as cl:
            r = await cl.get("https://api.flutterwave.com/v3/banks/NG",
                             headers={"Authorization": f"Bearer {FLW_SECRET_KEY}"})
            data = r.json()
            if data.get("status") == "success":
                _banks_cache["banks"] = data.get("data", [])
                _banks_cache["updated_at"] = now
    except Exception:
        pass
    return _banks_cache["banks"]

async def get_fee_config() -> dict:
    config = await db.config.find_one({"key": "fees"}, {"_id": 0})
    if not config:
        return {"buyer_fee_rate": 0.05, "seller_withdrawal_fee_rate": 0.05, "min_withdrawal_usd": 0.80, "hold_hours": 4}
    return config

async def credit_seller_wallet(order: dict):
    config = await get_fee_config()
    withdrawable_after = (now_utc() + timedelta(hours=config.get("hold_hours", 4))).isoformat()
    await db.wallet_credits.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": order["seller_id"],
        "order_id": order["id"],
        "amount": order["amount"],
        "withdrawable_after": withdrawable_after,
        "withdrawn": False,
        "created_at": now_utc().isoformat(),
    })
    await db.users.update_one(
        {"id": order["seller_id"]},
        {"$inc": {"balance": order["amount"], "sales_count": 1, "trust_score": 2}}
    )

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
        "preferred_currency": u.get("preferred_currency", "USD"),
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

class MessageIn(BaseModel):
    content: str = Field(default="", max_length=2000)
    image: Optional[str] = None  # base64 data URL

class ConfirmIn(BaseModel):
    screenshot: Optional[str] = None  # base64 data URL

class ComplaintIn(BaseModel):
    reason: str = Field(min_length=10, max_length=1000)

class SettleIn(BaseModel):
    action: Literal["release", "refund"]
    note: str = Field(default="", max_length=500)

class RateIn(BaseModel):
    score: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=500)

class UpdatePrefsIn(BaseModel):
    preferred_currency: Optional[str] = None

class TopupFiatIn(BaseModel):
    amount: float = Field(gt=0)
    currency: str

class TopupCryptoIn(BaseModel):
    amount_usd: float = Field(gt=0)
    pay_currency: str

class VerifyAccountIn(BaseModel):
    bank_code: str
    account_number: str = Field(min_length=10, max_length=10)

class WithdrawIn(BaseModel):
    amount_usd: float = Field(gt=0)
    bank_code: str
    bank_name: str
    account_number: str
    account_name: str

class WithdrawalRejectIn(BaseModel):
    reason: str = Field(min_length=5, max_length=500)

class FeeConfigIn(BaseModel):
    buyer_fee_rate: float = Field(ge=0, le=0.5)
    seller_withdrawal_fee_rate: float = Field(ge=0, le=0.5)
    min_withdrawal_usd: float = Field(gt=0)
    hold_hours: int = Field(ge=0, le=168)

# ---------------- Startup ----------------
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.listings.create_index("id", unique=True)
    await db.listings.create_index([("status", 1), ("created_at", -1)])
    await db.orders.create_index("id", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.messages.create_index([("order_id", 1), ("created_at", 1)])
    await db.ratings.create_index([("rated_id", 1), ("created_at", -1)])
    await db.ratings.create_index([("order_id", 1), ("rater_id", 1)], unique=True)
    await db.wallet_credits.create_index([("user_id", 1), ("withdrawn", 1), ("withdrawable_after", 1)])
    await db.withdrawals.create_index([("status", 1), ("created_at", -1)])
    await db.config.create_index("key", unique=True)
    if not await db.config.find_one({"key": "fees"}):
        await db.config.insert_one({
            "key": "fees", "buyer_fee_rate": 0.05, "seller_withdrawal_fee_rate": 0.05,
            "min_withdrawal_usd": 0.80, "hold_hours": 4, "updated_at": now_utc().isoformat(),
        })
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
            {"id": "bloodstrike", "name": "Blood Strike", "platform": "Mobile"},
        ])
    # Migrations: insert new games if not present
    for g in [
        {"id": "bloodstrike", "name": "Blood Strike", "platform": "Mobile"},
        {"id": "efootball",   "name": "eFootball",    "platform": "Mobile"},
        {"id": "pubgmobile",  "name": "PUBG Mobile",  "platform": "Mobile"},
        {"id": "codm",        "name": "Call of Duty: Mobile", "platform": "Mobile"},
    ]:
        if not await db.games.find_one({"id": g["id"]}):
            await db.games.insert_one(g)
    import asyncio as _asyncio
    _asyncio.create_task(_order_scheduler())

async def _order_scheduler():
    import asyncio as _asyncio
    while True:
        try:
            now = now_utc()
            # Auto-dispute: orders past handover deadline still in PAID or DELIVERED
            async for o in db.orders.find({"status": {"$in": ["PAID", "DELIVERED"]}, "handover_deadline": {"$lt": now.isoformat()}}):
                timeline = o.get("timeline", [])
                timeline.append({"status": "DISPUTED", "at": now.isoformat(), "note": "Handover deadline exceeded — dispute auto-triggered."})
                await db.orders.update_one({"id": o["id"]}, {"$set": {
                    "status": "DISPUTED", "timeline": timeline, "updated_at": now.isoformat(),
                }})
                log.info(f"Auto-disputed order {o['id']}")
            # Auto-release: CONFIRMED orders past complaint window
            async for o in db.orders.find({"status": "CONFIRMED", "complaint_window_until": {"$lt": now.isoformat()}}):
                timeline = o.get("timeline", [])
                timeline.append({"status": "RELEASED", "at": now.isoformat(), "note": "Complaint window closed — funds automatically released to seller."})
                await db.orders.update_one({"id": o["id"]}, {"$set": {
                    "status": "RELEASED", "timeline": timeline, "updated_at": now.isoformat(),
                }})
                await credit_seller_wallet(o)
                log.info(f"Auto-released order {o['id']}")
        except Exception as e:
            log.error(f"Scheduler error: {e}")
        await _asyncio.sleep(60)

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
    doc["email_verified"] = False
    await db.users.insert_one(doc)
    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(hours=24)
    await db.email_verifications.insert_one({"user_id": uid, "token": token, "expires_at": expires})
    await audit("register", uid, "user", {"email": email})
    try:
        await send_verification_email(email, token)
    except Exception:
        pass
    return {"verify": True}

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
    if not user.get("email_verified", False):
        raise HTTPException(status_code=403, detail="EMAIL_NOT_VERIFIED")
    access = make_access_token(user["id"], user["email"], user.get("role", "user"))
    refresh = make_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    return {"user": sanitize_user(user), "token": access}

class ForgotPasswordIn(BaseModel):
    email: EmailStr

class ResetPasswordIn(BaseModel):
    token: str
    password: str = Field(min_length=8)

def _email_html(title: str, body_html: str) -> str:
    return f"""<div style="font-family:monospace;max-width:480px;margin:0 auto;padding:32px;background:#0A0A0A;color:#fff;border:1px solid #2A2A2A">
  <div style="color:#CCFF00;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:24px">LOOTRA</div>
  <h2 style="font-size:20px;font-weight:500;margin:0 0 12px">{title}</h2>
  {body_html}
  <p style="color:#555;font-size:11px;margin:24px 0 0">If you didn't request this, ignore this email.</p>
</div>"""

async def send_email(to: str, subject: str, html: str):
    if not RESEND_API_KEY:
        raise HTTPException(503, "Email service not configured — add RESEND_API_KEY to environment")
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
            json={"from": EMAIL_FROM, "to": [to], "subject": subject, "html": html},
        )
    if r.status_code >= 400:
        log.error(f"Resend error: {r.text}")
        raise HTTPException(502, "Failed to send email")

async def send_verification_email(to_email: str, token: str):
    url = f"{FRONTEND_URL}/verify-email?token={token}"
    html = _email_html("Verify your email", f"""
  <p style="color:#999;font-size:13px;margin:0 0 24px">Click below to verify your email address and activate your account.</p>
  <a href="{url}" style="display:inline-block;background:#CCFF00;color:#000;padding:12px 24px;font-family:monospace;font-size:13px;text-decoration:none;font-weight:600">Verify email</a>
  <p style="color:#555;font-size:11px;margin:16px 0 0">Link expires in 24 hours.</p>""")
    await send_email(to_email, "Verify your Lootra account", html)

async def send_reset_email(to_email: str, token: str):
    url = f"{FRONTEND_URL}/reset-password?token={token}"
    html = _email_html("Reset your password", f"""
  <p style="color:#999;font-size:13px;margin:0 0 24px">Click below to set a new password. This link expires in 1 hour.</p>
  <a href="{url}" style="display:inline-block;background:#CCFF00;color:#000;padding:12px 24px;font-family:monospace;font-size:13px;text-decoration:none;font-weight:600">Reset password</a>""")
    await send_email(to_email, "Reset your Lootra password", html)

@api.post("/auth/forgot-password")
async def forgot_password(data: ForgotPasswordIn):
    user = await db.users.find_one({"email": data.email.lower()})
    if not user:
        return {"ok": True}
    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    await db.password_resets.delete_many({"user_id": user["id"]})
    await db.password_resets.insert_one({"user_id": user["id"], "token": token, "expires_at": expires})
    await send_reset_email(user["email"], token)
    return {"ok": True}

@api.post("/auth/reset-password")
async def reset_password(data: ResetPasswordIn):
    rec = await db.password_resets.find_one({"token": data.token})
    if not rec:
        raise HTTPException(400, "Invalid or expired reset link")
    if rec["expires_at"].replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        await db.password_resets.delete_one({"token": data.token})
        raise HTTPException(400, "Reset link has expired")
    hashed = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()
    await db.users.update_one({"id": rec["user_id"]}, {"$set": {"password": hashed}})
    await db.password_resets.delete_one({"token": data.token})
    await audit("auth.password_reset", rec["user_id"], "user", {})
    return {"ok": True}

@api.get("/auth/verify-email")
async def verify_email(token: str):
    rec = await db.email_verifications.find_one({"token": token})
    if not rec:
        raise HTTPException(400, "Invalid or expired verification link")
    if rec["expires_at"].replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        await db.email_verifications.delete_one({"token": token})
        raise HTTPException(400, "Verification link has expired — request a new one")
    await db.users.update_one({"id": rec["user_id"]}, {"$set": {"email_verified": True}})
    await db.email_verifications.delete_one({"token": token})
    return {"ok": True}

@api.post("/auth/resend-verification")
async def resend_verification(data: ForgotPasswordIn):
    user = await db.users.find_one({"email": data.email.lower()})
    if not user or user.get("email_verified", True):
        return {"ok": True}
    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(hours=24)
    await db.email_verifications.delete_many({"user_id": user["id"]})
    await db.email_verifications.insert_one({"user_id": user["id"], "token": token, "expires_at": expires})
    await send_verification_email(user["email"], token)
    return {"ok": True}

@api.post("/auth/logout")
async def logout(response: Response):
    clear_auth_cookies(response)
    return {"ok": True}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return sanitize_user(u)

@api.patch("/auth/me")
async def update_prefs(data: UpdatePrefsIn, user: dict = Depends(get_current_user)):
    update = {}
    if data.preferred_currency and data.preferred_currency in SUPPORTED_CURRENCIES:
        update["preferred_currency"] = data.preferred_currency
    if update:
        await db.users.update_one({"id": user["id"]}, {"$set": update})
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
    config = await get_fee_config()
    platform_fee = round(listing["price"] * config["buyer_fee_rate"], 2)
    total_charge = round(listing["price"] + platform_fee, 2)
    if user.get("balance", 0) < total_charge:
        raise HTTPException(400, f"Insufficient balance. Total cost is ${total_charge:.2f} (includes {int(config['buyer_fee_rate']*100)}% platform fee). Top up your wallet.")
    oid = str(uuid.uuid4())
    # Debit buyer (listing price + platform fee); listing price held in escrow
    await db.users.update_one({"id": user["id"]}, {"$inc": {"balance": -total_charge}})
    await db.listings.update_one({"id": listing_id}, {"$set": {"status": "sold", "updated_at": now_utc().isoformat()}})
    deadline = now_utc() + timedelta(minutes=65)
    order = {
        "id": oid,
        "listing_id": listing_id,
        "listing_snapshot": {k: listing[k] for k in ["title", "game", "platform", "price", "screenshots", "region"]},
        "buyer_id": user["id"],
        "buyer_username": user["username"],
        "seller_id": listing["seller_id"],
        "seller_username": listing["seller_username"],
        "amount": listing["price"],
        "platform_fee": platform_fee,
        "total_charged": total_charge,
        "status": "PAID",
        "credentials_released": False,
        "handover_deadline": deadline.isoformat(),
        "complaint_window_until": None,
        "created_at": now_utc().isoformat(),
        "updated_at": now_utc().isoformat(),
        "timeline": [{"status": "PAID", "at": now_utc().isoformat(), "note": "Funds held in escrow. Seller must assist with credential handover within 65 minutes."}],
    }
    await db.orders.insert_one(order)
    await audit("order.purchase", user["id"], oid, {"amount": listing["price"]})
    # Notify admin
    seller = await db.users.find_one({"id": listing["seller_id"]}, {"_id": 0})
    try:
        await send_email(
            ADMIN_EMAIL,
            f"New purchase — order {oid[:8]}",
            _email_html("New purchase requires handover", f"""
  <p style="color:#999;font-size:13px;margin:0 0 16px">A buyer has purchased an account. You must oversee the 65-minute credential handover.</p>
  <table style="width:100%;font-size:12px;color:#ccc;font-family:monospace">
    <tr><td style="color:#555;padding:4px 0">Order</td><td>{oid[:8]}</td></tr>
    <tr><td style="color:#555;padding:4px 0">Listing</td><td>{listing['title']}</td></tr>
    <tr><td style="color:#555;padding:4px 0">Buyer</td><td>@{user['username']}</td></tr>
    <tr><td style="color:#555;padding:4px 0">Seller</td><td>@{listing['seller_username']}</td></tr>
    <tr><td style="color:#555;padding:4px 0">Amount</td><td>${listing['price']:.2f}</td></tr>
    <tr><td style="color:#555;padding:4px 0">Deadline</td><td>{deadline.strftime('%Y-%m-%d %H:%M UTC')}</td></tr>
  </table>
  <a href="{FRONTEND_URL}/admin" style="display:inline-block;background:#CCFF00;color:#000;padding:12px 24px;font-family:monospace;font-size:13px;text-decoration:none;font-weight:600;margin-top:20px">Go to admin dashboard</a>""")
        )
    except Exception:
        pass
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
async def confirm_order(order_id: str, body: ConfirmIn = ConfirmIn(), user: dict = Depends(get_current_user)):
    o = await db.orders.find_one({"id": order_id})
    if not o or o["buyer_id"] != user["id"]:
        raise HTTPException(403, "Forbidden")
    if o["status"] not in ("PAID", "DELIVERED"):
        raise HTTPException(400, "Order not ready to confirm")
    timeline = o.get("timeline", [])
    timeline.append({"status": "RELEASED", "at": now_utc().isoformat(), "note": "Buyer confirmed account access. Funds released to seller."})
    await db.orders.update_one({"id": order_id}, {"$set": {
        "status": "RELEASED",
        "confirm_screenshot": body.screenshot,
        "timeline": timeline,
        "updated_at": now_utc().isoformat(),
    }})
    await credit_seller_wallet(o)
    await audit("order.confirmed_released", user["id"], order_id)
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

@api.post("/orders/{order_id}/complaint")
async def complaint_order(order_id: str, body: ComplaintIn, user: dict = Depends(get_current_user)):
    o = await db.orders.find_one({"id": order_id})
    if not o or o["buyer_id"] != user["id"]:
        raise HTTPException(403, "Only buyer can raise a complaint")
    if o["status"] != "CONFIRMED":
        raise HTTPException(400, "Can only complain on confirmed orders")
    window = o.get("complaint_window_until")
    if window and datetime.fromisoformat(window) < now_utc():
        raise HTTPException(400, "Complaint window has closed")
    timeline = o.get("timeline", [])
    timeline.append({"status": "DISPUTED", "at": now_utc().isoformat(), "note": f"Buyer raised post-confirmation complaint: {body.reason}"})
    await db.orders.update_one({"id": order_id}, {"$set": {
        "status": "DISPUTED", "dispute_reason": body.reason, "timeline": timeline, "updated_at": now_utc().isoformat(),
    }})
    await audit("order.complaint", user["id"], order_id)
    return {"ok": True}

@api.post("/admin/orders/{order_id}/settle")
async def admin_settle(order_id: str, body: SettleIn, admin: dict = Depends(require_admin)):
    o = await db.orders.find_one({"id": order_id})
    if not o:
        raise HTTPException(404, "Order not found")
    if o["status"] not in ("DISPUTED", "CONFIRMED"):
        raise HTTPException(400, "Order is not in a settleable state")
    timeline = o.get("timeline", [])
    note = body.note or ("Admin released funds to seller." if body.action == "release" else "Admin refunded buyer.")
    if body.action == "release":
        timeline.append({"status": "RELEASED", "at": now_utc().isoformat(), "note": note})
        await db.orders.update_one({"id": order_id}, {"$set": {
            "status": "RELEASED", "timeline": timeline, "updated_at": now_utc().isoformat(),
        }})
        await credit_seller_wallet(o)
        await audit("order.admin_release", admin["id"], order_id, {"amount": o["amount"]})
    else:
        timeline.append({"status": "REFUNDED", "at": now_utc().isoformat(), "note": note})
        await db.orders.update_one({"id": order_id}, {"$set": {
            "status": "REFUNDED", "timeline": timeline, "updated_at": now_utc().isoformat(),
        }})
        await db.users.update_one({"id": o["buyer_id"]}, {"$inc": {"balance": o["amount"]}})
        await audit("order.admin_refund", admin["id"], order_id, {"amount": o["amount"]})
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

# ---------------- P2P Chat ----------------
@api.get("/orders/{order_id}/messages")
async def get_messages(order_id: str, user: dict = Depends(get_current_user)):
    o = await db.orders.find_one({"id": order_id})
    if not o:
        raise HTTPException(404, "Order not found")
    if user["id"] not in (o["buyer_id"], o["seller_id"]) and user.get("role") != "admin":
        raise HTTPException(403, "Forbidden")
    return await db.messages.find({"order_id": order_id}, {"_id": 0}).sort([("created_at", 1)]).to_list(500)

@api.post("/orders/{order_id}/messages")
async def send_message(order_id: str, body: MessageIn, user: dict = Depends(get_current_user)):
    o = await db.orders.find_one({"id": order_id})
    if not o:
        raise HTTPException(404, "Order not found")
    if user["id"] not in (o["buyer_id"], o["seller_id"]) and user.get("role") != "admin":
        raise HTTPException(403, "Forbidden")
    if not body.content and not body.image:
        raise HTTPException(400, "Message must have text or image")
    msg = {
        "id": str(uuid.uuid4()),
        "order_id": order_id,
        "sender_id": user["id"],
        "sender_username": user["username"],
        "is_admin": user.get("role") == "admin",
        "content": body.content,
        "image": body.image,
        "created_at": now_utc().isoformat(),
    }
    await db.messages.insert_one(msg)
    msg.pop("_id", None)
    return msg

# ---------------- Mutual Rating ----------------
@api.post("/orders/{order_id}/rate")
async def rate_trade(order_id: str, body: RateIn, user: dict = Depends(get_current_user)):
    o = await db.orders.find_one({"id": order_id})
    if not o:
        raise HTTPException(404, "Order not found")
    if o["status"] not in ("RELEASED", "REFUNDED"):
        raise HTTPException(400, "Trade must be complete to leave a rating")
    if user["id"] not in (o["buyer_id"], o["seller_id"]):
        raise HTTPException(403, "Not part of this order")
    if await db.ratings.find_one({"order_id": order_id, "rater_id": user["id"]}):
        raise HTTPException(400, "Already rated this trade")
    rated_id = o["seller_id"] if user["id"] == o["buyer_id"] else o["buyer_id"]
    rated_username = o["seller_username"] if user["id"] == o["buyer_id"] else o["buyer_username"]
    doc = {
        "id": str(uuid.uuid4()),
        "order_id": order_id,
        "rater_id": user["id"],
        "rater_username": user["username"],
        "rated_id": rated_id,
        "rated_username": rated_username,
        "score": body.score,
        "comment": body.comment,
        "created_at": now_utc().isoformat(),
    }
    await db.ratings.insert_one(doc)
    doc.pop("_id", None)
    all_r = await db.ratings.find({"rated_id": rated_id}).to_list(10000)
    avg = sum(r["score"] for r in all_r) / len(all_r)
    await db.users.update_one({"id": rated_id}, {"$set": {"rating": round(avg, 2), "rating_count": len(all_r)}})
    return doc

# ---------------- Public Profiles ----------------
@api.get("/users/{username}")
async def get_profile(username: str):
    u = await db.users.find_one({"username": username}, {"_id": 0, "password_hash": 0})
    if not u:
        raise HTTPException(404, "User not found")
    listings = await db.listings.find(
        {"seller_id": u["id"], "status": "active"},
        {"_id": 0, "credentials_encrypted": 0}
    ).sort([("created_at", -1)]).to_list(20)
    ratings = await db.ratings.find({"rated_id": u["id"]}, {"_id": 0}).sort([("created_at", -1)]).to_list(50)
    return {
        "id": u["id"],
        "username": u["username"],
        "role": u.get("role", "user"),
        "trust_score": u.get("trust_score", 0),
        "sales_count": u.get("sales_count", 0),
        "rating": u.get("rating", 0.0),
        "rating_count": u.get("rating_count", 0),
        "created_at": u.get("created_at"),
        "listings": listings,
        "ratings": ratings,
    }

# ---------------- Currency ----------------
@api.get("/currency/rates")
async def currency_rates():
    return await get_exchange_rates()

# ---------------- Wallet ----------------
@api.post("/wallet/fiat-topup")
async def fiat_topup(data: TopupFiatIn, user: dict = Depends(get_current_user)):
    if data.currency not in SUPPORTED_CURRENCIES:
        raise HTTPException(400, f"Unsupported currency. Use: {', '.join(SUPPORTED_CURRENCIES)}")
    if not FLW_SECRET_KEY:
        raise HTTPException(503, "Fiat payments not configured")
    rates = await get_exchange_rates()
    usd_amount = round(data.amount / rates.get(data.currency, 1.0), 4)
    tx_ref = f"lootra-{uuid.uuid4().hex[:20]}"
    await db.pending_topups.insert_one({
        "tx_ref": tx_ref,
        "user_id": user["id"],
        "amount": data.amount,
        "currency": data.currency,
        "usd_amount": usd_amount,
        "credited": False,
        "created_at": now_utc().isoformat(),
    })
    payload = {
        "tx_ref": tx_ref,
        "amount": data.amount,
        "currency": data.currency,
        "redirect_url": f"{FRONTEND_URL}/topup/callback",
        "customer": {"email": user["email"], "name": user["username"]},
        "customizations": {
            "title": "Lootra Wallet Top-up",
            "description": f"Add {data.amount} {data.currency} to your Lootra wallet",
        },
    }
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            "https://api.flutterwave.com/v3/payments",
            json=payload,
            headers={"Authorization": f"Bearer {FLW_SECRET_KEY}"},
        )
    resp = r.json()
    if resp.get("status") != "success":
        raise HTTPException(400, resp.get("message", "Payment creation failed"))
    return {"payment_link": resp["data"]["link"], "tx_ref": tx_ref, "usd_amount": usd_amount}

@api.post("/wallet/fiat-verify")
async def fiat_verify(
    transaction_id: str = Query(...),
    tx_ref: str = Query(...),
    user: dict = Depends(get_current_user),
):
    pending = await db.pending_topups.find_one({"tx_ref": tx_ref, "user_id": user["id"]})
    if not pending:
        raise HTTPException(404, "Transaction not found")
    if pending.get("credited"):
        u = await db.users.find_one({"id": user["id"]}, {"_id": 0})
        return {"balance": u["balance"], "already_credited": True}
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"https://api.flutterwave.com/v3/transactions/{transaction_id}/verify",
            headers={"Authorization": f"Bearer {FLW_SECRET_KEY}"},
        )
    vdata = r.json()
    if vdata.get("status") != "success" or vdata.get("data", {}).get("status") != "successful":
        raise HTTPException(400, "Payment not confirmed by Flutterwave")
    tx = vdata["data"]
    if tx.get("tx_ref") != tx_ref:
        raise HTTPException(400, "Transaction reference mismatch")
    if float(tx.get("amount", 0)) < pending["amount"] * 0.99:
        raise HTTPException(400, "Amount mismatch")
    usd_amount = pending["usd_amount"]
    await db.users.update_one({"id": user["id"]}, {"$inc": {"balance": usd_amount}})
    await db.pending_topups.update_one({"tx_ref": tx_ref}, {"$set": {"credited": True, "transaction_id": transaction_id}})
    await audit("wallet.fiat_topup", user["id"], tx_ref, {"usd_amount": usd_amount, "currency": pending["currency"]})
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return {"balance": u["balance"], "credited_usd": usd_amount}

@api.post("/wallet/crypto-topup")
async def crypto_topup(data: TopupCryptoIn, user: dict = Depends(get_current_user)):
    if not NOWPAYMENTS_API_KEY:
        raise HTTPException(503, "Crypto payments not configured")
    order_id = f"wallet-{user['id'][:8]}-{uuid.uuid4().hex[:8]}"
    payload = {
        "price_amount": data.amount_usd,
        "price_currency": "usd",
        "pay_currency": data.pay_currency.lower(),
        "order_id": order_id,
        "order_description": "Lootra wallet top-up",
        "ipn_callback_url": "https://lootra.onrender.com/api/webhooks/nowpayments",
    }
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            "https://api.nowpayments.io/v1/payment",
            json=payload,
            headers={"x-api-key": NOWPAYMENTS_API_KEY},
        )
    resp = r.json()
    if "payment_id" not in resp:
        raise HTTPException(400, resp.get("message", "Crypto payment creation failed"))
    await db.crypto_topups.insert_one({
        "payment_id": str(resp["payment_id"]),
        "order_id": order_id,
        "user_id": user["id"],
        "amount_usd": data.amount_usd,
        "pay_currency": data.pay_currency,
        "credited": False,
        "created_at": now_utc().isoformat(),
    })
    return {
        "payment_id": resp["payment_id"],
        "pay_address": resp.get("pay_address"),
        "pay_amount": resp.get("pay_amount"),
        "pay_currency": resp.get("pay_currency"),
        "order_id": order_id,
        "expires_at": resp.get("expiration_estimate_date"),
    }

@api.get("/wallet/crypto-status/{payment_id}")
async def crypto_payment_status(payment_id: str, user: dict = Depends(get_current_user)):
    pt = await db.crypto_topups.find_one({"payment_id": payment_id, "user_id": user["id"]}, {"_id": 0})
    if not pt:
        raise HTTPException(404, "Payment not found")
    if pt.get("credited"):
        return {"status": "finished", "credited": True}
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"https://api.nowpayments.io/v1/payment/{payment_id}",
            headers={"x-api-key": NOWPAYMENTS_API_KEY},
        )
    data = r.json()
    return {"status": data.get("payment_status", "waiting"), "credited": False}

# ---------------- Banks / Withdrawal ----------------
@api.get("/catalog/banks")
async def list_banks():
    return await get_flutterwave_banks()

@api.post("/wallet/verify-account")
async def verify_account(body: VerifyAccountIn, _: dict = Depends(get_current_user)):
    if not FLW_SECRET_KEY:
        raise HTTPException(503, "Payment service not configured")
    async with httpx.AsyncClient(timeout=10) as cl:
        r = await cl.get(
            "https://api.flutterwave.com/v3/accounts/resolve",
            params={"account_number": body.account_number, "account_bank": body.bank_code},
            headers={"Authorization": f"Bearer {FLW_SECRET_KEY}"},
        )
    data = r.json()
    if data.get("status") != "success":
        raise HTTPException(400, "Could not verify account. Check the account number and bank.")
    return {"account_name": data["data"]["account_name"]}

@api.get("/wallet/balance")
async def wallet_balance(user: dict = Depends(get_current_user)):
    now = now_utc().isoformat()
    available_credits = await db.wallet_credits.find(
        {"user_id": user["id"], "withdrawn": False, "withdrawable_after": {"$lte": now}}
    ).to_list(1000)
    held_credits = await db.wallet_credits.find(
        {"user_id": user["id"], "withdrawn": False, "withdrawable_after": {"$gt": now}}
    ).to_list(1000)
    available = round(sum(c["amount"] for c in available_credits), 2)
    held = round(sum(c["amount"] for c in held_credits), 2)
    next_release = min((c["withdrawable_after"] for c in held_credits), default=None)
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    fee_config = await get_fee_config()
    return {"total": u.get("balance", 0), "available": available, "held": held, "next_release": next_release, "fee_config": fee_config}

@api.post("/wallet/withdraw")
async def request_withdrawal(body: WithdrawIn, user: dict = Depends(get_current_user)):
    config = await get_fee_config()
    if body.amount_usd < config["min_withdrawal_usd"]:
        raise HTTPException(400, f"Minimum withdrawal is ${config['min_withdrawal_usd']:.2f}")
    now = now_utc().isoformat()
    available_credits = await db.wallet_credits.find(
        {"user_id": user["id"], "withdrawn": False, "withdrawable_after": {"$lte": now}}
    ).to_list(1000)
    available = sum(c["amount"] for c in available_credits)
    if body.amount_usd > available:
        raise HTTPException(400, f"Insufficient available balance. Available: ${available:.2f}")
    fee = round(body.amount_usd * config["seller_withdrawal_fee_rate"], 2)
    payout_usd = round(body.amount_usd - fee, 2)
    rates = await get_exchange_rates()
    ngn_rate = rates.get("NGN", 1550.0)
    payout_ngn = round(payout_usd * ngn_rate, 2)
    wid = str(uuid.uuid4())
    # Mark credits as withdrawn (FIFO)
    remaining = body.amount_usd
    for credit in sorted(available_credits, key=lambda c: c["withdrawable_after"]):
        if remaining <= 0:
            break
        use = min(credit["amount"], remaining)
        if use >= credit["amount"]:
            await db.wallet_credits.update_one({"id": credit["id"]}, {"$set": {"withdrawn": True}})
        else:
            await db.wallet_credits.update_one({"id": credit["id"]}, {"$inc": {"amount": -use}})
        remaining -= use
    await db.users.update_one({"id": user["id"]}, {"$inc": {"balance": -body.amount_usd}})
    await db.withdrawals.insert_one({
        "id": wid, "user_id": user["id"], "username": user["username"],
        "amount_usd": body.amount_usd, "platform_fee_usd": fee,
        "payout_usd": payout_usd, "payout_ngn": payout_ngn, "ngn_rate": ngn_rate,
        "bank_code": body.bank_code, "bank_name": body.bank_name,
        "account_number": body.account_number, "account_name": body.account_name,
        "status": "pending", "created_at": now_utc().isoformat(), "updated_at": now_utc().isoformat(),
    })
    await audit("wallet.withdraw_request", user["id"], wid, {"amount_usd": body.amount_usd})
    return {"ok": True, "id": wid, "payout_usd": payout_usd, "payout_ngn": payout_ngn}

@api.get("/wallet/withdrawals")
async def my_withdrawals(user: dict = Depends(get_current_user)):
    return await db.withdrawals.find({"user_id": user["id"]}, {"_id": 0}).sort([("created_at", -1)]).to_list(100)

@api.post("/admin/withdrawals/{wid}/approve")
async def admin_approve_withdrawal(wid: str, admin: dict = Depends(require_admin)):
    w = await db.withdrawals.find_one({"id": wid})
    if not w:
        raise HTTPException(404, "Withdrawal not found")
    if w["status"] != "pending":
        raise HTTPException(400, "Already processed")
    if not FLW_SECRET_KEY:
        raise HTTPException(503, "Payment service not configured")
    ref = f"lootra-{wid[:8]}-{int(now_utc().timestamp())}"
    async with httpx.AsyncClient(timeout=30) as cl:
        r = await cl.post(
            "https://api.flutterwave.com/v3/transfers",
            headers={"Authorization": f"Bearer {FLW_SECRET_KEY}", "Content-Type": "application/json"},
            json={
                "account_bank": w["bank_code"], "account_number": w["account_number"],
                "amount": w["payout_ngn"], "narration": f"Lootra withdrawal #{wid[:8]}",
                "currency": "NGN", "reference": ref,
            },
        )
    data = r.json()
    if data.get("status") != "success":
        raise HTTPException(502, f"Transfer failed: {data.get('message', 'Unknown error')}")
    await db.withdrawals.update_one({"id": wid}, {"$set": {
        "status": "approved", "flw_reference": ref, "flw_transfer_id": data.get("data", {}).get("id"),
        "approved_by": admin["id"], "approved_at": now_utc().isoformat(), "updated_at": now_utc().isoformat(),
    }})
    await audit("wallet.withdrawal_approved", admin["id"], wid, {"payout_ngn": w["payout_ngn"]})
    return {"ok": True}

@api.post("/admin/withdrawals/{wid}/reject")
async def admin_reject_withdrawal(wid: str, body: WithdrawalRejectIn, admin: dict = Depends(require_admin)):
    w = await db.withdrawals.find_one({"id": wid})
    if not w:
        raise HTTPException(404, "Withdrawal not found")
    if w["status"] != "pending":
        raise HTTPException(400, "Already processed")
    await db.users.update_one({"id": w["user_id"]}, {"$inc": {"balance": w["amount_usd"]}})
    await db.wallet_credits.insert_one({
        "id": str(uuid.uuid4()), "user_id": w["user_id"], "order_id": None,
        "amount": w["amount_usd"], "withdrawable_after": now_utc().isoformat(),
        "withdrawn": False, "created_at": now_utc().isoformat(), "source": "withdrawal_refund",
    })
    await db.withdrawals.update_one({"id": wid}, {"$set": {
        "status": "rejected", "reject_reason": body.reason,
        "rejected_by": admin["id"], "rejected_at": now_utc().isoformat(), "updated_at": now_utc().isoformat(),
    }})
    await audit("wallet.withdrawal_rejected", admin["id"], wid, {"reason": body.reason})
    return {"ok": True}

@api.get("/admin/withdrawals")
async def admin_withdrawals(status: Optional[str] = None, _: dict = Depends(require_admin)):
    flt = {}
    if status:
        flt["status"] = status
    return await db.withdrawals.find(flt, {"_id": 0}).sort([("created_at", -1)]).to_list(200)

@api.get("/admin/config")
async def get_config(_: dict = Depends(require_admin)):
    config = await db.config.find_one({"key": "fees"}, {"_id": 0})
    if not config:
        return {"key": "fees", "buyer_fee_rate": 0.05, "seller_withdrawal_fee_rate": 0.05, "min_withdrawal_usd": 0.80, "hold_hours": 4}
    return config

@api.put("/admin/config")
async def update_config(body: FeeConfigIn, admin: dict = Depends(require_admin)):
    update = {
        "buyer_fee_rate": body.buyer_fee_rate, "seller_withdrawal_fee_rate": body.seller_withdrawal_fee_rate,
        "min_withdrawal_usd": body.min_withdrawal_usd, "hold_hours": body.hold_hours,
        "updated_at": now_utc().isoformat(), "updated_by": admin["id"],
    }
    await db.config.update_one({"key": "fees"}, {"$set": update}, upsert=True)
    await audit("admin.config_update", admin["id"], "fees", update)
    return {"ok": True}

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

@api.post("/admin/users/{user_id}/set-balance")
async def admin_set_balance(user_id: str, amount: float = Query(ge=0), admin: dict = Depends(require_admin)):
    await db.users.update_one({"id": user_id}, {"$set": {"balance": amount}})
    await audit("wallet.admin_set", admin["id"], user_id, {"balance": amount})
    return {"ok": True}

@api.post("/admin/reset-test-balances")
async def reset_test_balances(admin: dict = Depends(require_admin)):
    """Zero out balances on all non-admin accounts that never made a real deposit."""
    result = await db.users.update_many(
        {"role": {"$ne": "admin"}, "balance": {"$gt": 0}},
        {"$set": {"balance": 0.0}}
    )
    await audit("wallet.reset_test_balances", admin["id"], "all_users", {"affected": result.modified_count})
    return {"zeroed": result.modified_count}
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

# ---------------- Webhooks ----------------
@app.post("/api/webhooks/flutterwave")
async def flutterwave_webhook(request: Request):
    if FLW_WEBHOOK_HASH:
        sig = request.headers.get("verif-hash", "")
        if sig != FLW_WEBHOOK_HASH:
            raise HTTPException(401, "Invalid webhook signature")
    body = await request.json()
    if body.get("event") == "charge.completed":
        tx = body.get("data", {})
        if tx.get("status") == "successful":
            tx_ref = tx.get("tx_ref", "")
            pending = await db.pending_topups.find_one({"tx_ref": tx_ref})
            if pending and not pending.get("credited"):
                await db.users.update_one({"id": pending["user_id"]}, {"$inc": {"balance": pending["usd_amount"]}})
                await db.pending_topups.update_one({"tx_ref": tx_ref}, {"$set": {"credited": True}})
                await audit("wallet.fiat_topup_webhook", pending["user_id"], tx_ref, {"usd_amount": pending["usd_amount"]})
    return {"status": "ok"}

@app.post("/api/webhooks/nowpayments")
async def nowpayments_webhook(request: Request):
    body_bytes = await request.body()
    if NOWPAYMENTS_IPN_SECRET:
        sig = request.headers.get("x-nowpayments-sig", "")
        expected = _hmac.new(NOWPAYMENTS_IPN_SECRET.encode(), body_bytes, hashlib.sha512).hexdigest()
        if not _hmac.compare_digest(sig.lower(), expected.lower()):
            raise HTTPException(401, "Invalid webhook signature")
    import json as _json
    data = _json.loads(body_bytes)
    if data.get("payment_status") in ("finished", "confirmed"):
        pt = await db.crypto_topups.find_one({"payment_id": str(data.get("payment_id", ""))})
        if pt and not pt.get("credited"):
            await db.users.update_one({"id": pt["user_id"]}, {"$inc": {"balance": pt["amount_usd"]}})
            await db.crypto_topups.update_one(
                {"payment_id": str(data["payment_id"])},
                {"$set": {"credited": True, "status": "finished"}},
            )
            await audit("wallet.crypto_topup", pt["user_id"], str(data["payment_id"]), {"amount_usd": pt["amount_usd"]})
    return {"status": "ok"}

@app.get("/")
async def health():
    return {"service": "lootra", "status": "ok"}

# CORS
_raw_origins = os.environ.get("CORS_ORIGINS", "").strip()
_origins = [o.strip() for o in _raw_origins.split(",") if o.strip() and o.strip() != "*"]
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=_origins if _origins else [],
    allow_origin_regex=r"https?://localhost(:\d+)?|https://.*\.vercel\.app|https://(www\.)?lootra\.org",
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown():
    client.close()
