import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { ShieldCheck, Lock, MapPin, Trophy, Star, Heart } from "lucide-react";
import { api, formatError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useCurrency } from "../context/CurrencyContext";

const PLACEHOLDER = "https://images.unsplash.com/photo-1775801535042-52672e4d93ca?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";

export default function ListingDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user, refresh } = useAuth();
  const { formatPrice, currency } = useCurrency();
  const [listing, setListing] = useState(null);
  const [activeImg, setActiveImg] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/listings/${id}`).then(({ data }) => setListing(data)).catch(() => toast.error("Listing not found"));
  }, [id]);

  const buy = async () => {
    if (!user) { nav("/login"); return; }
    setBusy(true);
    try {
      const { data } = await api.post(`/orders/${id}/purchase`);
      toast.success("Purchase secured — funds held in escrow");
      await refresh();
      nav(`/order/${data.id}`);
    } catch (e) { toast.error(formatError(e)); }
    finally { setBusy(false); }
  };

  const watch = async () => {
    if (!user) { nav("/login"); return; }
    try { await api.post(`/watchlist/${id}`); toast.success("Watchlist updated"); }
    catch (e) { toast.error(formatError(e)); }
  };

  if (!listing) return <div className="font-mono text-xs text-neutral-500">Loading…</div>;

  const screenshots = listing.screenshots?.length ? listing.screenshots : [PLACEHOLDER];

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-8 animate-fade-in" data-testid="listing-detail">
      <div className="space-y-6">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] font-mono text-neutral-500">{listing.game} · {listing.platform}</div>
          <h1 className="text-3xl md:text-4xl font-medium tracking-tight mt-2" data-testid="listing-title">{listing.title}</h1>
          <div className="flex flex-wrap gap-2 mt-3">
            {listing.verified && <span className="lootra-badge lootra-badge-accent inline-flex items-center gap-1"><ShieldCheck className="w-3 h-3" />ADMIN VERIFIED</span>}
            <span className="lootra-badge">{listing.region}</span>
            {listing.rank && <span className="lootra-badge">RANK · {listing.rank}</span>}
          </div>
        </div>

        <div className="space-y-3">
          <div className="lootra-card overflow-hidden aspect-[16/9]">
            <img src={screenshots[activeImg]} alt="" className="w-full h-full object-cover" />
          </div>
          {screenshots.length > 1 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {screenshots.map((s, i) => (
                <button key={i} onClick={() => setActiveImg(i)} className={`shrink-0 w-24 aspect-[16/10] border ${i === activeImg ? "border-[#CCFF00]" : "border-[#2A2A2A]"}`} data-testid={`thumb-${i}`}>
                  <img src={s} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[#2A2A2A]" data-testid="listing-stats">
          {[
            ["Level", listing.level || "—"],
            ["Age", `${listing.account_age_years || 0}y`],
            ["Skins", listing.skins_count || 0],
            ["Views", listing.views || 0],
          ].map(([k, v]) => (
            <div key={k} className="bg-[#0A0A0A] p-4">
              <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500">{k}</div>
              <div className="font-mono text-lg mt-1">{v}</div>
            </div>
          ))}
        </div>

        <div className="lootra-card p-6">
          <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500 mb-3">Description</div>
          <p className="text-sm text-neutral-300 whitespace-pre-wrap leading-relaxed" data-testid="listing-description">{listing.description}</p>
        </div>
      </div>

      {/* Buy panel */}
      <aside className="space-y-4 lg:sticky lg:top-24 self-start">
        <div className="lootra-card p-6 space-y-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500">Price</div>
            <div className="font-mono text-3xl text-[#CCFF00] mt-1" data-testid="listing-price">{formatPrice(listing.price)}</div>
            {currency !== "USD" && (
              <div className="text-xs text-neutral-500 font-mono mt-0.5">= ${listing.price?.toFixed(2)} USD</div>
            )}
          </div>
          <div className="text-xs text-neutral-400 flex items-start gap-2">
            <Lock className="w-4 h-4 text-[#CCFF00] shrink-0 mt-0.5" />
            <span>Funds held in escrow until you confirm successful account access.</span>
          </div>
          {user?.role === "admin" ? (
            <div className="lootra-badge w-full text-center text-neutral-400">Admin accounts cannot purchase</div>
          ) : listing.status === "active" ? (
            <button onClick={buy} disabled={busy || (user && user.id === listing.seller_id)} className="lootra-btn-primary w-full" data-testid="buy-now-btn">
              {busy ? "Processing…" : user?.id === listing.seller_id ? "Your own listing" : "Buy with escrow"}
            </button>
          ) : (
            <div className="lootra-badge w-full text-center" data-testid="listing-unavailable">UNAVAILABLE — {listing.status?.toUpperCase()}</div>
          )}
          {user?.role !== "admin" && (
            <button onClick={watch} className="lootra-btn-secondary w-full inline-flex items-center justify-center gap-2" data-testid="watchlist-btn">
              <Heart className="w-4 h-4" /> Add to watchlist
            </button>
          )}
        </div>

        <div className="lootra-card p-6 space-y-3">
          <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500">Seller</div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium" data-testid="listing-seller">@{listing.seller_username}</div>
              <div className="text-xs text-neutral-500 font-mono">ID {listing.seller_id.slice(0,8)}</div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 text-[#CCFF00] font-mono text-sm"><Star className="w-3 h-3 fill-current" /> Trusted</div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
