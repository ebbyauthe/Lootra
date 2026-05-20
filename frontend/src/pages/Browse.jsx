import React, { useEffect, useState } from "react";
import { SlidersHorizontal, ChevronDown, ChevronUp, X } from "lucide-react";
import { api } from "../lib/api";
import ListingCard from "../components/ListingCard";

export default function Browse() {
  const [listings, setListings] = useState([]);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    q: "", game: "", platform: "", region: "", min_price: "", max_price: "", verified: "", sort: "newest",
  });

  useEffect(() => { api.get("/catalog/games").then(({ data }) => { if (Array.isArray(data)) setGames(data); }).catch(() => {}); }, []);

  const fetchListings = async () => {
    setLoading(true);
    const params = {};
    Object.entries(filters).forEach(([k, v]) => { if (v !== "" && v !== null) params[k] = v; });
    try {
      const { data } = await api.get("/listings", { params });
      if (Array.isArray(data)) setListings(data);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchListings(); /* eslint-disable-next-line */ }, []);

  const upd = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const DEFAULT_FILTERS = { q: "", game: "", platform: "", region: "", min_price: "", max_price: "", verified: "", sort: "newest" };
  const clearFilters = () => { setFilters(DEFAULT_FILTERS); };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="lootra-badge inline-block mb-3">MARKETPLACE</div>
          <h1 className="text-3xl md:text-4xl font-medium tracking-tight">Browse accounts</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="font-mono text-xs text-neutral-500" data-testid="results-count">{listings.length} RESULTS</div>
          <button onClick={() => setFiltersOpen((o) => !o)} className="lootra-btn-secondary !py-2 !px-3 inline-flex items-center gap-2 text-xs">
            <SlidersHorizontal className="w-3 h-3" /> Filters {filtersOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      <div className={`grid gap-6 ${filtersOpen ? "lg:grid-cols-[260px_1fr]" : ""}`}>
        {/* Filter sidebar */}
        {filtersOpen && (
        <aside className="lootra-card p-5 h-fit space-y-5 lg:sticky lg:top-24" data-testid="filter-sidebar">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs tracking-[0.2em] uppercase font-mono text-neutral-400">
              <SlidersHorizontal className="w-3 h-3" /> Filters
            </div>
            <button onClick={clearFilters} className="text-xs font-mono text-neutral-500 hover:text-white flex items-center gap-1">
              <X className="w-3 h-3" /> Clear
            </button>
          </div>

          <div>
            <div className="text-[10px] uppercase font-mono text-neutral-500 mb-2">Game</div>
            <select className="lootra-input" value={filters.game} onChange={(e) => upd("game", e.target.value)} data-testid="filter-game">
              <option value="">All games</option>
              {games.map((g) => <option key={g.id} value={g.name}>{g.name}</option>)}
            </select>
          </div>

          <div>
            <div className="text-[10px] uppercase font-mono text-neutral-500 mb-2">Platform</div>
            <select className="lootra-input" value={filters.platform} onChange={(e) => upd("platform", e.target.value)} data-testid="filter-platform">
              <option value="">Any</option>
              <option>PC</option><option>PS</option><option>Xbox</option><option>Mobile</option><option>Switch</option>
            </select>
          </div>

          <div>
            <div className="text-[10px] uppercase font-mono text-neutral-500 mb-2">Region</div>
            <select className="lootra-input" value={filters.region} onChange={(e) => upd("region", e.target.value)} data-testid="filter-region">
              <option value="">Any</option>
              <option>NA</option><option>EU</option><option>APAC</option><option>LATAM</option><option>Global</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[10px] uppercase font-mono text-neutral-500 mb-2">Min $</div>
              <input type="number" className="lootra-input" value={filters.min_price} onChange={(e) => upd("min_price", e.target.value)} data-testid="filter-min-price" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono text-neutral-500 mb-2">Max $</div>
              <input type="number" className="lootra-input" value={filters.max_price} onChange={(e) => upd("max_price", e.target.value)} data-testid="filter-max-price" />
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase font-mono text-neutral-500 mb-2">Verified only</div>
            <select className="lootra-input" value={filters.verified} onChange={(e) => upd("verified", e.target.value)} data-testid="filter-verified">
              <option value="">Any</option>
              <option value="true">Verified</option>
            </select>
          </div>

          <div>
            <div className="text-[10px] uppercase font-mono text-neutral-500 mb-2">Sort</div>
            <select className="lootra-input" value={filters.sort} onChange={(e) => upd("sort", e.target.value)} data-testid="filter-sort">
              <option value="newest">Newest</option>
              <option value="price_asc">Price ascending</option>
              <option value="price_desc">Price descending</option>
            </select>
          </div>

          <button onClick={() => { fetchListings(); setFiltersOpen(false); }} className="lootra-btn-primary w-full" data-testid="apply-filters-btn">Apply filters</button>
        </aside>
        )}

        {/* Results */}
        <div>
          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1,2,3,4,5,6].map(i => <div key={i} className="lootra-card aspect-[16/13] animate-pulse" />)}
            </div>
          ) : listings.length === 0 ? (
            <div className="border border-dashed border-[#2A2A2A] p-16 text-center text-neutral-500 font-mono text-sm">
              No listings match your filters.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {listings.map((l) => <ListingCard key={l.id} listing={l} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
