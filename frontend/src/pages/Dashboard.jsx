import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Wallet, ShoppingBag, Tag, Heart } from "lucide-react";
import { api, formatError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useCurrency } from "../context/CurrencyContext";

function Stat({ label, value, icon: Icon }) {
  return (
    <div className="lootra-card p-6 flex flex-col gap-2" data-testid={`stat-${label.toLowerCase().replace(/\s+/g,'-')}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500">{label}</span>
        <Icon className="w-4 h-4 text-[#CCFF00]" />
      </div>
      <div className="font-mono text-2xl">{value}</div>
    </div>
  );
}

const STATUS_COLORS = {
  PAID: "text-[#FFB020]", DELIVERED: "text-[#3B82F6]", CONFIRMED: "text-[#CCFF00]",
  RELEASED: "text-[#CCFF00]", DISPUTED: "text-[#FF453A]", REFUNDED: "text-neutral-400",
};

export default function Dashboard() {
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const [tab, setTab] = useState("purchases");
  const [purchases, setPurchases] = useState([]);
  const [sales, setSales] = useState([]);
  const [listings, setListings] = useState([]);
  const [watch, setWatch] = useState([]);

  const load = async () => {
    const [p, s, l, w] = await Promise.all([
      api.get("/orders/mine", { params: { role: "buyer" } }),
      api.get("/orders/mine", { params: { role: "seller" } }),
      api.get("/listings/mine/all"),
      api.get("/watchlist"),
    ]);
    setPurchases(p.data); setSales(s.data); setListings(l.data); setWatch(w.data);
  };

  useEffect(() => { load().catch(() => {}); }, []);

  const TABS = [
    { id: "purchases", label: "Purchases", count: purchases.length },
    { id: "sales", label: "Sales", count: sales.length },
    { id: "listings", label: "My Listings", count: listings.length },
    { id: "watchlist", label: "Watchlist", count: watch.length },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="lootra-badge inline-block mb-3">CONTROL ROOM</div>
          <h1 className="text-3xl md:text-4xl font-medium tracking-tight">Hey @{user?.username}</h1>
          <p className="text-sm text-neutral-400 mt-1">Manage purchases, listings, and your escrow wallet.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/topup" className="lootra-btn-secondary inline-flex items-center gap-2" data-testid="topup-link"><Wallet className="w-4 h-4" /> Top Up</Link>
          <Link to="/sell" className="lootra-btn-primary inline-flex items-center gap-2" data-testid="new-listing-btn"><Plus className="w-4 h-4" /> New listing</Link>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Wallet" value={formatPrice(user?.balance)} icon={Wallet} />
        <Stat label="Purchases" value={purchases.length} icon={ShoppingBag} />
        <Stat label="Active Listings" value={listings.filter(l => l.status === "active").length} icon={Tag} />
        <Stat label="Trust score" value={user?.trust_score || 0} icon={Heart} />
      </div>

      <div className="border-b border-[#2A2A2A] flex gap-1 overflow-x-auto no-scrollbar" data-testid="dashboard-tabs">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-3 text-sm tracking-tight transition-colors border-b-2 ${
              tab === t.id ? "border-[#CCFF00] text-white" : "border-transparent text-neutral-400 hover:text-white"
            }`}
            data-testid={`tab-${t.id}`}>
            {t.label} <span className="font-mono text-xs text-neutral-500">({t.count})</span>
          </button>
        ))}
      </div>

      {tab === "purchases" && <OrdersTable orders={purchases} type="buyer" />}
      {tab === "sales" && <OrdersTable orders={sales} type="seller" />}
      {tab === "listings" && <ListingsTable listings={listings} reload={load} />}
      {tab === "watchlist" && <WatchGrid items={watch} />}
    </div>
  );
}

function OrdersTable({ orders, type }) {
  if (orders.length === 0)
    return <div className="border border-dashed border-[#2A2A2A] p-12 text-center text-neutral-500 font-mono text-sm">No {type === "buyer" ? "purchases" : "sales"} yet.</div>;
  return (
    <div className="space-y-3">
      {orders.map((o) => (
        <div key={o.id} className="lootra-card p-4 flex flex-col gap-3" data-testid={`order-row-${o.id}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-medium text-sm truncate">{o.listing_snapshot?.title}</div>
              <div className="text-[10px] font-mono text-neutral-500 mt-0.5">
                #{o.id.slice(0,8)} · @{type === "buyer" ? o.seller_username : o.buyer_username}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-mono text-[#CCFF00] text-sm">${o.amount.toFixed(2)}</div>
              <div className={`font-mono text-[10px] mt-0.5 ${STATUS_COLORS[o.status] || ""}`}>{o.status}</div>
            </div>
          </div>
          <Link to={`/order/${o.id}`} className="lootra-btn-secondary !py-2 text-center text-xs w-full" data-testid={`view-order-${o.id}`}>
            View order →
          </Link>
        </div>
      ))}
    </div>
  );
}

function ListingsTable({ listings, reload }) {
  const remove = async (id) => {
    if (!window.confirm("Delete listing?")) return;
    try { await api.delete(`/listings/${id}`); toast.success("Removed"); reload(); }
    catch (e) { toast.error(formatError(e)); }
  };
  if (listings.length === 0)
    return <div className="border border-dashed border-[#2A2A2A] p-12 text-center text-neutral-500 font-mono text-sm">No listings yet. <Link to="/sell" className="text-[#CCFF00] underline">Create one</Link>.</div>;
  return (
    <div className="space-y-3">
      {listings.map((l) => (
        <div key={l.id} className="lootra-card p-4 flex flex-col gap-3" data-testid={`mylisting-row-${l.id}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link to={`/listing/${l.id}`} className="font-medium text-sm truncate block hover:text-[#CCFF00]">{l.title}</Link>
              <div className="text-[10px] font-mono text-neutral-500 mt-0.5">{l.game} · {l.views} views</div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-mono text-[#CCFF00] text-sm">${l.price.toFixed(2)}</div>
              <div className="font-mono text-[10px] text-neutral-400 mt-0.5">{l.status.toUpperCase()}</div>
            </div>
          </div>
          {l.status !== "sold" && (
            <button onClick={() => remove(l.id)} className="lootra-btn-secondary !py-2 text-center text-xs w-full !border-[#FF453A] !text-[#FF453A]" data-testid={`delete-listing-${l.id}`}>
              Delete listing
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function WatchGrid({ items }) {
  if (items.length === 0)
    return <div className="border border-dashed border-[#2A2A2A] p-12 text-center text-neutral-500 font-mono text-sm">Nothing saved yet.</div>;
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {items.map((l) => (
        <Link key={l.id} to={`/listing/${l.id}`} className="lootra-card p-4">
          <div className="text-xs uppercase tracking-[0.2em] font-mono text-neutral-500">{l.game}</div>
          <div className="font-medium mt-1 truncate">{l.title}</div>
          <div className="font-mono text-[#CCFF00] mt-3">${l.price.toFixed(2)}</div>
        </Link>
      ))}
    </div>
  );
}
