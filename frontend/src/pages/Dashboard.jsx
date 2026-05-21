import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Wallet, ShoppingBag, Tag, Heart, ArrowDownToLine, X, ChevronDown, Search } from "lucide-react";
import { api, formatError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useCurrency } from "../context/CurrencyContext";

function Stat({ label, value, icon: Icon, sub }) {
  return (
    <div className="lootra-card p-6 flex flex-col gap-2" data-testid={`stat-${label.toLowerCase().replace(/\s+/g,'-')}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500">{label}</span>
        <Icon className="w-4 h-4 text-[#CCFF00]" />
      </div>
      <div className="font-mono text-2xl">{value}</div>
      {sub && <div className="text-[10px] font-mono text-neutral-500">{sub}</div>}
    </div>
  );
}

const STATUS_COLORS = {
  PAID: "text-[#FFB020]", DELIVERED: "text-[#3B82F6]", CONFIRMED: "text-[#CCFF00]",
  RELEASED: "text-[#CCFF00]", DISPUTED: "text-[#FF453A]", REFUNDED: "text-neutral-400",
};

function WithdrawModal({ onClose, walletBalance, onSuccess }) {
  const { formatPrice } = useCurrency();
  const [banks, setBanks] = useState([]);
  const [bankSearch, setBankSearch] = useState("");
  const [bankOpen, setBankOpen] = useState(false);
  const [selectedBank, setSelectedBank] = useState(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [amountUsd, setAmountUsd] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feeInfo, setFeeInfo] = useState(null);
  const [feeLoading, setFeeLoading] = useState(false);

  const available = walletBalance?.available ?? 0;

  useEffect(() => {
    api.get("/catalog/banks").then(r => setBanks(r.data)).catch(() => {});
  }, []);

  const fetchFee = useCallback(async (amt) => {
    const parsed = parseFloat(amt);
    if (!parsed || parsed <= 0) { setFeeInfo(null); return; }
    setFeeLoading(true);
    try {
      const r = await api.get("/wallet/balance");
      const config = r.data?.fee_config;
      if (config) {
        const fee = parsed * (config.seller_withdrawal_fee_rate ?? 0.05);
        const net = parsed - fee;
        setFeeInfo({ fee: fee.toFixed(2), net: net.toFixed(2), rate: config.seller_withdrawal_fee_rate });
      }
    } catch {}
    setFeeLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchFee(amountUsd), 400);
    return () => clearTimeout(t);
  }, [amountUsd, fetchFee]);

  const verify = async () => {
    if (!selectedBank || accountNumber.length !== 10) {
      toast.error("Select a bank and enter a 10-digit account number");
      return;
    }
    setVerifying(true);
    setAccountName(null);
    try {
      const r = await api.post("/wallet/verify-account", {
        bank_code: selectedBank.code,
        account_number: accountNumber,
      });
      setAccountName(r.data.account_name);
    } catch (e) {
      toast.error(formatError(e) || "Could not verify account");
    }
    setVerifying(false);
  };

  const submit = async () => {
    const amt = parseFloat(amountUsd);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    if (amt > available) { toast.error("Amount exceeds available balance"); return; }
    if (!selectedBank) { toast.error("Select a bank"); return; }
    if (!accountName) { toast.error("Verify your account number first"); return; }
    setSubmitting(true);
    try {
      await api.post("/wallet/withdraw", {
        amount_usd: amt,
        bank_code: selectedBank.code,
        bank_name: selectedBank.name,
        account_number: accountNumber,
        account_name: accountName,
      });
      toast.success("Withdrawal request submitted. Admin will process it shortly.");
      onSuccess();
      onClose();
    } catch (e) {
      toast.error(formatError(e));
    }
    setSubmitting(false);
  };

  const filteredBanks = banks.filter(b =>
    b.name.toLowerCase().includes(bankSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#111] border border-[#2A2A2A] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[#111] border-b border-[#2A2A2A] px-5 py-4 flex items-center justify-between z-10">
          <div>
            <div className="lootra-badge inline-block mb-1 text-[9px]">WITHDRAW</div>
            <div className="font-medium text-sm">Request withdrawal</div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#1a1a1a] rounded-lg"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Available balance */}
          <div className="bg-[#1a1a1a] rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-neutral-400">Available to withdraw</span>
            <span className="font-mono text-[#CCFF00] font-bold">{formatPrice(available)}</span>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500">Amount (USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 font-mono text-sm">$</span>
              <input
                type="number"
                min="0.80"
                step="0.01"
                value={amountUsd}
                onChange={e => setAmountUsd(e.target.value)}
                placeholder="0.00"
                className="w-full bg-[#1a1a1a] border border-[#2A2A2A] rounded-xl px-4 py-3 pl-7 font-mono text-sm focus:outline-none focus:border-[#CCFF00] text-white"
              />
              <button
                type="button"
                onClick={() => setAmountUsd(available.toFixed(2))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[#CCFF00] hover:underline"
              >MAX</button>
            </div>
          </div>

          {/* Fee preview */}
          {amountUsd && parseFloat(amountUsd) > 0 && (
            <div className="bg-[#1a1a1a] rounded-xl px-4 py-3 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between text-neutral-400">
                <span>Platform fee ({feeInfo ? `${(feeInfo.rate * 100).toFixed(0)}%` : "5%"})</span>
                <span className="text-[#FF453A]">{feeLoading ? "..." : feeInfo ? `-$${feeInfo.fee}` : ""}</span>
              </div>
              <div className="flex justify-between border-t border-[#2A2A2A] pt-1.5">
                <span className="text-neutral-400">You receive</span>
                <span className="text-[#CCFF00]">{feeLoading ? "..." : feeInfo ? `$${feeInfo.net}` : ""}</span>
              </div>
              <div className="text-[9px] text-neutral-600 mt-1">Converted to NGN at live rate at time of transfer</div>
            </div>
          )}

          {/* Bank dropdown */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500">Bank</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setBankOpen(v => !v)}
                className="w-full bg-[#1a1a1a] border border-[#2A2A2A] rounded-xl px-4 py-3 text-sm text-left flex items-center justify-between focus:outline-none focus:border-[#CCFF00]"
              >
                <span className={selectedBank ? "text-white" : "text-neutral-500"}>
                  {selectedBank ? selectedBank.name : "Select bank…"}
                </span>
                <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0" />
              </button>
              {bankOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-[#2A2A2A] rounded-xl z-20 max-h-48 overflow-hidden flex flex-col shadow-xl">
                  <div className="p-2 border-b border-[#2A2A2A] flex items-center gap-2">
                    <Search className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                    <input
                      autoFocus
                      value={bankSearch}
                      onChange={e => setBankSearch(e.target.value)}
                      placeholder="Search banks…"
                      className="flex-1 bg-transparent text-sm focus:outline-none text-white placeholder:text-neutral-600"
                    />
                  </div>
                  <div className="overflow-y-auto">
                    {filteredBanks.length === 0 && (
                      <div className="px-4 py-3 text-sm text-neutral-500">No results</div>
                    )}
                    {filteredBanks.map(b => (
                      <button
                        key={b.code}
                        type="button"
                        onClick={() => { setSelectedBank(b); setBankOpen(false); setBankSearch(""); setAccountName(null); }}
                        className="w-full px-4 py-2.5 text-sm text-left hover:bg-[#2A2A2A] text-white transition-colors"
                      >{b.name}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Account number + verify */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500">Account Number</label>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={10}
                value={accountNumber}
                onChange={e => { setAccountNumber(e.target.value.replace(/\D/g, "")); setAccountName(null); }}
                placeholder="0000000000"
                className="flex-1 bg-[#1a1a1a] border border-[#2A2A2A] rounded-xl px-4 py-3 font-mono text-sm focus:outline-none focus:border-[#CCFF00] text-white"
              />
              <button
                type="button"
                onClick={verify}
                disabled={verifying || !selectedBank || accountNumber.length !== 10}
                className="lootra-btn-secondary !py-3 px-4 text-xs shrink-0 disabled:opacity-40"
              >{verifying ? "…" : "Verify"}</button>
            </div>
            {accountName && (
              <div className="flex items-center gap-2 px-3 py-2 bg-[#CCFF00]/10 border border-[#CCFF00]/30 rounded-lg">
                <div className="w-1.5 h-1.5 rounded-full bg-[#CCFF00] shrink-0" />
                <span className="text-sm font-medium text-[#CCFF00]">{accountName}</span>
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !accountName || !amountUsd || parseFloat(amountUsd) <= 0}
            className="w-full lootra-btn-primary py-3.5 disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <ArrowDownToLine className="w-4 h-4" />
            {submitting ? "Submitting…" : "Request withdrawal"}
          </button>

          <p className="text-[10px] text-center text-neutral-600 font-mono leading-relaxed">
            Withdrawals are reviewed and processed by admins within 24h.
            Funds will be sent to the verified bank account above.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const [tab, setTab] = useState("purchases");
  const [purchases, setPurchases] = useState([]);
  const [sales, setSales] = useState([]);
  const [listings, setListings] = useState([]);
  const [watch, setWatch] = useState([]);
  const [walletBalance, setWalletBalance] = useState(null);
  const [showWithdraw, setShowWithdraw] = useState(false);

  const loadWallet = async () => {
    try {
      const r = await api.get("/wallet/balance");
      setWalletBalance(r.data);
    } catch {}
  };

  const load = async () => {
    const [p, s, l, w] = await Promise.all([
      api.get("/orders/mine", { params: { role: "buyer" } }),
      api.get("/orders/mine", { params: { role: "seller" } }),
      api.get("/listings/mine/all"),
      api.get("/watchlist"),
    ]);
    setPurchases(p.data); setSales(s.data); setListings(l.data); setWatch(w.data);
  };

  useEffect(() => {
    load().catch(() => {});
    loadWallet();
  }, []);

  const TABS = [
    { id: "purchases", label: "Purchases", count: purchases.length },
    { id: "sales", label: "Sales", count: sales.length },
    { id: "listings", label: "My Listings", count: listings.length },
    { id: "watchlist", label: "Watchlist", count: watch.length },
  ];

  const heldSub = () => {
    if (!walletBalance?.held || walletBalance.held <= 0) return null;
    if (walletBalance.next_release) {
      const diff = new Date(walletBalance.next_release) - new Date();
      if (diff > 0) {
        const hrs = Math.ceil(diff / 3600000);
        return `Next release in ~${hrs}h`;
      }
    }
    return "Pending release";
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="lootra-badge inline-block mb-3">CONTROL ROOM</div>
          <h1 className="text-3xl md:text-4xl font-medium tracking-tight">Hey @{user?.username}</h1>
          <p className="text-sm text-neutral-400 mt-1">Manage purchases, listings, and your escrow wallet.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link to="/topup" className="lootra-btn-secondary inline-flex items-center gap-2" data-testid="topup-link"><Wallet className="w-4 h-4" /> Top Up</Link>
          <button
            onClick={() => setShowWithdraw(true)}
            className="lootra-btn-secondary inline-flex items-center gap-2"
            data-testid="withdraw-btn"
          ><ArrowDownToLine className="w-4 h-4" /> Withdraw</button>
          <Link to="/sell" className="lootra-btn-primary inline-flex items-center gap-2" data-testid="new-listing-btn"><Plus className="w-4 h-4" /> New listing</Link>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="Total Balance"
          value={formatPrice(walletBalance?.total ?? user?.balance ?? 0)}
          icon={Wallet}
        />
        <Stat
          label="Available"
          value={formatPrice(walletBalance?.available ?? 0)}
          icon={ArrowDownToLine}
          sub="Ready to withdraw"
        />
        <Stat
          label="Held"
          value={formatPrice(walletBalance?.held ?? 0)}
          icon={ShoppingBag}
          sub={heldSub()}
        />
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

      {showWithdraw && (
        <WithdrawModal
          onClose={() => setShowWithdraw(false)}
          walletBalance={walletBalance}
          onSuccess={loadWallet}
        />
      )}
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
