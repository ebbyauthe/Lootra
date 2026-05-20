# Lootra — PRD & Build State

**Created:** 2026-02-20 (Feb)
**Stack:** React (CRA) + FastAPI + MongoDB
**Auth:** JWT (httpOnly cookies) + Bearer fallback
**Payments:** Mocked (wallet topup + $500 signup bonus; Stripe deferred)

## Original Problem Statement
Lootra — a modern, secure, scalable marketplace for buying/selling gaming and (later) digital accounts. Trust-first, escrow-protected, admin-moderated, with an encrypted credential vault. Dark, minimalist, not over-gamy.

## User Personas
- **Trader (combined)**: buys and sells gaming accounts using the same profile.
- **Admin**: approves listings, accesses vault, manages disputes/refunds, bans users.

## Core Requirements (frozen)
- Email/password auth with bcrypt + JWT; brute-force lockout
- Listings with admin approval workflow; encrypted credentials at rest (Fernet)
- Escrow lifecycle: PAID → DELIVERED → CONFIRMED → RELEASED (+ DISPUTED/REFUNDED)
- Watchlist, reviews, trust score
- Admin dashboard: pending listings, all orders, users, vault, audit log
- Categories scalable for social/streaming/subscription (gaming live, others UI-gated)

## What's Implemented (Feb 2026)
- **Backend** (`/app/backend/server.py`)
  - Auth: register, login, logout, me, refresh, brute-force lockout, admin seed
  - Catalog: games + categories seeded
  - Listings: create (pending), list+filter, get, my-listings, delete
  - Orders/Escrow: purchase, reveal (decrypt), confirm, dispute, review
  - Watchlist toggle
  - Wallet: mock topup
  - Admin: stats, listings(approve/reject), orders(refund), users(ban), vault, audit
- **Frontend** (`/app/frontend/src`)
  - Dark theme (Obsidian black + Electric Lime); Space Grotesk + JetBrains Mono
  - Pages: Landing, Browse (filters), ListingDetail, Login, Register, Dashboard, CreateListing (wizard), OrderDetail (stepper, reveal, dispute, review), AdminDashboard (tabbed)
  - AuthContext (cookie-based), ProtectedRoute, Layout with header/footer
  - data-testid coverage on all interactive elements
- **Testing**: pytest e2e — 32/33 (97%) backend; landing/browse/login/register render verified.

## Test Credentials
See `/app/memory/test_credentials.md`.
- Admin: `admin@lootra.com` / `Admin@12345`

## P0 Remaining (None blocking)
- (none — all core flows working)

## P1 Backlog
- Real Stripe escrow (replace mock topup)
- Notification center (in-app + email)
- Seller public profile page with reviews list
- OAuth (Google/Discord) + 2FA
- Order chat with admin moderation logging
- AI scam detection + price estimation (Claude Sonnet via Emergent LLM key)

## P2 Backlog
- Social media / streaming / subscription categories enabled
- Recommendation engine
- Live marketplace trends + analytics charts
- Crypto payments
- DDoS / WAF hardening
- File/screenshot upload via object storage (currently URL-paste only)

## Notes for Next Iteration
- Server.py is ~700 lines — split into routers (auth/listings/orders/admin) before adding more endpoints.
- Add per-email lockout key in addition to IP (works behind proxy).
- Set explicit `CORS_ORIGINS` in `.env` for production hardening.
