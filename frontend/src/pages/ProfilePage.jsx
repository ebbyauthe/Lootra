import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { Star, ShieldCheck, Package } from "lucide-react";
import { api, formatError } from "../lib/api";
import ListingCard from "../components/ListingCard";

function StarRow({ score }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={`w-3.5 h-3.5 ${score >= s ? "text-[#CCFF00] fill-current" : "text-neutral-700"}`} />
      ))}
    </div>
  );
}

export default function ProfilePage() {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setProfile(null); setError(null);
    api.get(`/users/${username}`)
      .then(({ data }) => setProfile(data))
      .catch((e) => setError(e?.response?.status === 404 ? "not_found" : formatError(e)));
  }, [username]);

  if (error === "not_found") return (
    <div className="max-w-2xl mx-auto py-20 text-center font-mono text-neutral-500">
      <div className="text-4xl mb-4">404</div>
      <div>User <span className="text-white">@{username}</span> not found.</div>
    </div>
  );

  if (error) return (
    <div className="max-w-2xl mx-auto py-20 text-center font-mono text-neutral-500">
      <div className="text-red-400 mb-2">Failed to load profile</div>
      <div className="text-xs">{error}</div>
    </div>
  );

  if (!profile) return <div className="font-mono text-xs text-neutral-500 p-12">Loading profile…</div>;

  const joinYear = profile.created_at ? new Date(profile.created_at).getFullYear() : "—";
  const rating = profile.rating || 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      {/* Profile header */}
      <div className="lootra-card p-6 flex flex-col sm:flex-row gap-6 items-start">
        <div className="w-16 h-16 bg-[#CCFF00] flex items-center justify-center shrink-0">
          <span className="text-black font-bold text-2xl font-mono">{profile.username[0].toUpperCase()}</span>
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-medium tracking-tight">@{profile.username}</h1>
            {profile.role === "admin" && (
              <span className="lootra-badge lootra-badge-accent inline-flex items-center gap-1 text-xs">
                <ShieldCheck className="w-3 h-3" /> Admin
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-4 text-xs font-mono text-neutral-500">
            <span>Member since {joinYear}</span>
            <span>·</span>
            <span>{profile.sales_count || 0} sales</span>
            <span>·</span>
            <span>{profile.rating_count || 0} ratings</span>
          </div>
          {profile.rating_count > 0 && (
            <div className="flex items-center gap-2">
              <StarRow score={Math.round(rating)} />
              <span className="text-sm font-mono text-[#CCFF00]">{rating.toFixed(1)}</span>
              <span className="text-xs text-neutral-500">({profile.rating_count})</span>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          ["Sales", profile.sales_count || 0],
          ["Rating", profile.rating_count > 0 ? `${(profile.rating || 0).toFixed(1)} ★` : "—"],
          ["Trust", profile.trust_score || 0],
        ].map(([k, v]) => (
          <div key={k} className="lootra-card p-4 text-center">
            <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500">{k}</div>
            <div className="font-mono text-xl mt-1 text-[#CCFF00]">{v}</div>
          </div>
        ))}
      </div>

      {/* Active listings */}
      {profile.listings?.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500">
            <Package className="w-3 h-3" /> Active listings ({profile.listings.length})
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {profile.listings.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
        </div>
      )}

      {/* Ratings */}
      <div className="space-y-4">
        <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500">
          Reviews ({profile.ratings?.length || 0})
        </div>
        {(!profile.ratings || profile.ratings.length === 0) ? (
          <div className="border border-dashed border-[#2A2A2A] p-10 text-center text-neutral-600 font-mono text-xs">
            No reviews yet.
          </div>
        ) : (
          <div className="space-y-3">
            {profile.ratings.map((r) => (
              <div key={r.id} className="lootra-card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StarRow score={r.score} />
                    <Link to={`/user/${r.rater_username}`} className="text-xs font-mono text-neutral-400 hover:text-white hover:underline">
                      @{r.rater_username}
                    </Link>
                  </div>
                  <span className="text-[10px] text-neutral-600 font-mono">{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                {r.comment && <p className="text-sm text-neutral-300 leading-relaxed">{r.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
