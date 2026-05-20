import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Lock, Eye, Zap, ArrowRight } from "lucide-react";
import { api } from "../lib/api";
import ListingCard from "../components/ListingCard";

const FEATURES = [
  { icon: Lock, title: "Encrypted Vault", desc: "Credentials sealed with AES-128 Fernet. Revealed only after escrow clears." },
  { icon: ShieldCheck, title: "Escrow First", desc: "Every transaction held until the buyer confirms account access." },
  { icon: Eye, title: "Admin Verified", desc: "Each listing manually reviewed before going live. No bots, no spam." },
  { icon: Zap, title: "Instant Delivery", desc: "Verified accounts ship the moment your purchase clears." },
];

export default function Landing() {
  const [featured, setFeatured] = useState([]);
  useEffect(() => {
    api.get("/listings?limit=6").then(({ data }) => setFeatured(data)).catch(() => {});
  }, []);

  return (
    <div className="space-y-24 animate-fade-in">
      {/* Hero */}
      <section className="grid md:grid-cols-12 gap-8 items-center pt-8" data-testid="hero-section">
        <div className="md:col-span-7 space-y-6">
          <div className="lootra-badge inline-block" data-testid="hero-tag">ESCROW-PROTECTED MARKETPLACE</div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-medium tracking-tighter leading-[1.05]">
            Buy & sell gaming accounts <span className="text-[#CCFF00]">without the scam tax.</span>
          </h1>
          <p className="text-neutral-400 text-base md:text-lg max-w-xl">
            Lootra holds funds in escrow, encrypts every credential, and verifies every listing
            — so traders can move accounts like they move pixels.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/browse" className="lootra-btn-primary inline-flex items-center gap-2" data-testid="hero-browse-btn">
              Browse marketplace <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/sell" className="lootra-btn-secondary inline-flex items-center gap-2" data-testid="hero-sell-btn">
              List an account
            </Link>
          </div>
          <div className="flex items-center gap-6 pt-4 text-xs font-mono text-neutral-500">
            <div><span className="text-[#CCFF00]">0%</span> chargeback fraud</div>
            <div><span className="text-[#CCFF00]">100%</span> escrow protected</div>
            <div><span className="text-[#CCFF00]">24h</span> avg dispute resolution</div>
          </div>
        </div>
        <div className="md:col-span-5">
          <div className="lootra-card overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1775801535042-52672e4d93ca?crop=entropy&cs=srgb&fm=jpg&q=85&w=900"
              alt="dark gaming setup"
              className="w-full aspect-[4/5] object-cover opacity-80"
            />
            <div className="p-4 border-t border-[#2A2A2A]">
              <div className="text-[10px] tracking-[0.2em] uppercase font-mono text-neutral-500">Live escrow</div>
              <div className="font-mono text-xs text-neutral-300 mt-1">
                <span className="text-[#CCFF00]">●</span> $24,381 currently held across 142 active orders
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="features-section">
        {FEATURES.map((f) => (
          <div key={f.title} className="lootra-card p-6">
            <f.icon className="w-5 h-5 text-[#CCFF00] mb-4" />
            <h3 className="font-medium mb-2">{f.title}</h3>
            <p className="text-sm text-neutral-400 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* Featured listings */}
      <section className="space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <div className="lootra-badge inline-block mb-3">LIVE LISTINGS</div>
            <h2 className="text-2xl md:text-3xl font-medium tracking-tight">Recently dropped</h2>
          </div>
          <Link to="/browse" className="text-sm text-[#CCFF00] hover:underline" data-testid="view-all-link">View all →</Link>
        </div>
        {featured.length === 0 ? (
          <div className="border border-dashed border-[#2A2A2A] p-12 text-center text-sm text-neutral-500 font-mono">
            No active listings yet. Be the first to <Link to="/sell" className="text-[#CCFF00] underline">list an account</Link>.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featured.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="border-t border-[#2A2A2A] pt-12">
        <div className="lootra-badge inline-block mb-3">HOW IT WORKS</div>
        <h2 className="text-2xl md:text-3xl font-medium tracking-tight mb-8">A four-step trade — guarded end-to-end</h2>
        <div className="grid md:grid-cols-4 gap-px bg-[#2A2A2A]">
          {[
            ["01", "Seller submits", "Credentials encrypted into the vault. Listing waits for admin approval."],
            ["02", "Admin verifies", "Each account is hand-checked for legitimacy before going live."],
            ["03", "Buyer pays", "Funds locked in escrow — neither party can move them mid-trade."],
            ["04", "Buyer confirms", "Once access is verified, funds release to the seller automatically."],
          ].map(([n, t, d]) => (
            <div key={n} className="bg-[#0A0A0A] p-6">
              <div className="font-mono text-[#CCFF00] text-2xl">{n}</div>
              <div className="font-medium mt-3">{t}</div>
              <div className="text-sm text-neutral-400 mt-2 leading-relaxed">{d}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
