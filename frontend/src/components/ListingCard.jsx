import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Eye } from "lucide-react";

const PLACEHOLDERS = [
  "https://images.unsplash.com/photo-1775801535042-52672e4d93ca?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
  "https://images.pexels.com/photos/30469967/pexels-photo-30469967.jpeg?auto=compress&cs=tinysrgb&w=800",
  "https://images.unsplash.com/photo-1543328011-1c0d628fae09?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
  "https://images.unsplash.com/photo-1766601269332-6f012c9e80f9?crop=entropy&cs=srgb&fm=jpg&q=85&w=800",
];

export default function ListingCard({ listing, onClickOverride }) {
  const img = listing.screenshots?.[0] || PLACEHOLDERS[(listing.title?.length || 0) % PLACEHOLDERS.length];
  return (
    <Link to={`/listing/${listing.id}`} onClick={onClickOverride ? (e) => { e.preventDefault(); onClickOverride(); } : undefined} className="lootra-card group block" data-testid={`listing-card-${listing.id}`}>
      <div className="relative aspect-[16/10] overflow-hidden">
        <img src={img} alt={listing.title} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
        <div className="absolute top-3 left-3 flex gap-2">
          <span className="lootra-badge">{listing.platform}</span>
          {listing.verified && (
            <span className="lootra-badge lootra-badge-accent inline-flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> VERIFIED
            </span>
          )}
        </div>
        <div className="absolute bottom-3 right-3 font-mono text-xs text-neutral-400 flex items-center gap-1">
          <Eye className="w-3 h-3" /> {listing.views || 0}
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.2em] font-mono text-neutral-500 truncate">{listing.game}</div>
            <h3 className="text-base font-medium truncate mt-1">{listing.title}</h3>
          </div>
          <div className="text-right shrink-0">
            <div className="font-mono text-[#CCFF00] text-lg leading-tight">${listing.price?.toFixed(2)}</div>
            <div className="text-[10px] uppercase font-mono text-neutral-500 tracking-widest">USD</div>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-neutral-500 font-mono pt-2 border-t border-[#2A2A2A]">
          <Link to={`/user/${listing.seller_username}`} onClick={(e) => e.stopPropagation()} className="hover:text-white hover:underline">@{listing.seller_username}</Link>
          <span>{listing.region}</span>
        </div>
      </div>
    </Link>
  );
}
