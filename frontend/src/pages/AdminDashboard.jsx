import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, X, RefreshCw, Eye, Ban } from "lucide-react";
import { api, formatError } from "../lib/api";

export default function AdminDashboard() {
  const [tab, setTab] = useState("pending");
  const [stats, setStats] = useState({});
  const [pending, setPending] = useState([]);
  const [active, setActive] = useState([]);
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [audit, setAudit] = useState([]);
  const [vault, setVault] = useState(null);

  const load = async () => {
    const safe = async (fn) => { try { return await fn(); } catch (e) { toast.error(formatError(e)); return null; } };
    const [s, p, ac, o, u, a] = await Promise.all([
      safe(() => api.get("/admin/stats")),
      safe(() => api.get("/admin/listings", { params: { status: "pending" } })),
      safe(() => api.get("/admin/listings", { params: { status: "active" } })),
      safe(() => api.get("/admin/orders")),
      safe(() => api.get("/admin/users")),
      safe(() => api.get("/admin/audit", { params: { limit: 100 } })),
    ]);
    if (s) setStats(s.data);
    if (p && Array.isArray(p.data)) setPending(p.data);
    if (ac && Array.isArray(ac.data)) setActive(ac.data);
    if (o && Array.isArray(o.data)) setOrders(o.data);
    if (u && Array.isArray(u.data)) setUsers(u.data);
    if (a && Array.isArray(a.data)) setAudit(a.data);
  };
  useEffect(() => { load(); }, []);

  const approve = async (id) => { try { await api.post(`/admin/listings/${id}/approve`); toast.success("Approved"); load(); } catch (e) { toast.error(formatError(e)); } };
  const reject = async (id) => { try { await api.post(`/admin/listings/${id}/reject`); toast.success("Rejected"); load(); } catch (e) { toast.error(formatError(e)); } };
  const refund = async (id) => { try { await api.post(`/admin/orders/${id}/refund`); toast.success("Refunded"); load(); } catch (e) { toast.error(formatError(e)); } };
  const ban = async (id) => { try { await api.post(`/admin/users/${id}/ban`); toast.success("User banned"); load(); } catch (e) { toast.error(formatError(e)); } };
  const resetBalances = async () => {
    if (!window.confirm("Reset ALL user balances to $0? This cannot be undone.")) return;
    try { const { data } = await api.post("/admin/reset-test-balances"); toast.success(`Balances reset — ${data.affected} users updated`); load(); }
    catch (e) { toast.error(formatError(e)); }
  };
  const peekVault = async (id) => {
    try { const { data } = await api.get(`/admin/vault/${id}`); setVault({ id, ...data }); }
    catch (e) { toast.error(formatError(e)); }
  };

  const TABS = [
    { id: "pending", label: "Pending", count: pending.length },
    { id: "active", label: "Active listings", count: active.length },
    { id: "orders", label: "All orders", count: orders.length },
    { id: "users", label: "Users", count: users.length },
    { id: "audit", label: "Audit log", count: audit.length },
  ];

  return (
    <div className="space-y-8 animate-fade-in" data-testid="admin-dashboard">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="lootra-badge lootra-badge-accent inline-block mb-3">ADMIN</div>
          <h1 className="text-3xl md:text-4xl font-medium tracking-tight">Operations</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={resetBalances} className="lootra-btn-secondary inline-flex items-center gap-2 !border-[#FF453A] !text-[#FF453A]">Reset all balances to $0</button>
          <button onClick={load} className="lootra-btn-secondary inline-flex items-center gap-2" data-testid="admin-refresh"><RefreshCw className="w-4 h-4" /> Refresh</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="admin-stats">
        {[
          ["Users", stats.users || 0, "users"],
          ["Pending", stats.listings_pending || 0, "pending"],
          ["Active", stats.listings_active || 0, "active"],
          ["Orders", stats.orders_total || 0, "orders"],
          ["Held", stats.orders_held || 0, "orders"],
          ["Disputed", stats.orders_disputed || 0, "orders"],
        ].map(([k, v, tabId]) => (
          <button key={k} onClick={() => setTab(tabId)} className="lootra-card p-4 text-left hover:border-[#CCFF00] transition-colors">
            <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500">{k}</div>
            <div className="font-mono text-2xl mt-2 text-[#CCFF00]">{v}</div>
          </button>
        ))}
      </div>

      <div className="border-b border-[#2A2A2A] flex gap-1 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-3 text-sm transition-colors border-b-2 ${tab === t.id ? "border-[#CCFF00] text-white" : "border-transparent text-neutral-400 hover:text-white"}`}
            data-testid={`admin-tab-${t.id}`}>
            {t.label} <span className="font-mono text-xs text-neutral-500">({t.count})</span>
          </button>
        ))}
      </div>

      {tab === "pending" && (
        <Table head={["Title", "Game", "Seller", "Price", "Created", "Actions"]}>
          {pending.map((l) => (
            <tr key={l.id} className="border-t border-[#2A2A2A]" data-testid={`pending-row-${l.id}`}>
              <td className="px-4 py-3 truncate max-w-[260px]">{l.title}</td>
              <td className="px-4 py-3 text-neutral-400">{l.game}</td>
              <td className="px-4 py-3 text-neutral-400">@{l.seller_username}</td>
              <td className="px-4 py-3 font-mono text-[#CCFF00]">${l.price.toFixed(2)}</td>
              <td className="px-4 py-3 font-mono text-xs text-neutral-500">{new Date(l.created_at).toLocaleDateString()}</td>
              <td className="px-4 py-3 text-right space-x-2">
                <button onClick={() => peekVault(l.id)} className="lootra-btn-secondary !py-1 !px-2 inline-flex items-center gap-1 text-xs" data-testid={`vault-${l.id}`}><Eye className="w-3 h-3" /> Vault</button>
                <button onClick={() => approve(l.id)} className="lootra-btn-primary !py-1 !px-2 inline-flex items-center gap-1 text-xs" data-testid={`approve-${l.id}`}><Check className="w-3 h-3" /> Approve</button>
                <button onClick={() => reject(l.id)} className="lootra-btn-secondary !py-1 !px-2 inline-flex items-center gap-1 text-xs !border-[#FF453A] !text-[#FF453A]" data-testid={`reject-${l.id}`}><X className="w-3 h-3" /> Reject</button>
              </td>
            </tr>
          ))}
        </Table>
      )}

      {tab === "active" && (
        <Table head={["Title", "Game", "Seller", "Price", "Created", "Actions"]}>
          {active.map((l) => (
            <tr key={l.id} className="border-t border-[#2A2A2A]">
              <td className="px-4 py-3 truncate max-w-[260px]">{l.title}</td>
              <td className="px-4 py-3 text-neutral-400">{l.game}</td>
              <td className="px-4 py-3 text-neutral-400">@{l.seller_username}</td>
              <td className="px-4 py-3 font-mono text-[#CCFF00]">${l.price.toFixed(2)}</td>
              <td className="px-4 py-3 font-mono text-xs text-neutral-500">{new Date(l.created_at).toLocaleDateString()}</td>
              <td className="px-4 py-3 text-right">
                <button onClick={() => reject(l.id)} className="lootra-btn-secondary !py-1 !px-2 text-xs !border-[#FF453A] !text-[#FF453A]"><X className="w-3 h-3 inline mr-1" />Remove</button>
              </td>
            </tr>
          ))}
        </Table>
      )}

      {tab === "orders" && (
        <Table head={["Order", "Listing", "Buyer", "Seller", "Amount", "Status", "Actions"]}>
          {orders.map((o) => (
            <tr key={o.id} className="border-t border-[#2A2A2A]" data-testid={`admin-order-${o.id}`}>
              <td className="px-4 py-3 font-mono text-xs">#{o.id.slice(0,8)}</td>
              <td className="px-4 py-3 truncate max-w-[200px]">{o.listing_snapshot?.title}</td>
              <td className="px-4 py-3 text-neutral-400">@{o.buyer_username}</td>
              <td className="px-4 py-3 text-neutral-400">@{o.seller_username}</td>
              <td className="px-4 py-3 font-mono text-[#CCFF00]">${o.amount.toFixed(2)}</td>
              <td className="px-4 py-3 font-mono text-xs">{o.status}</td>
              <td className="px-4 py-3 text-right">
                {["PAID","DELIVERED","DISPUTED"].includes(o.status) && (
                  <button onClick={() => refund(o.id)} className="lootra-btn-secondary !py-1 !px-2 text-xs" data-testid={`refund-${o.id}`}>Refund buyer</button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}

      {tab === "users" && (
        <Table head={["User", "Email", "Role", "Balance", "Sales", "Trust", "Actions"]}>
          {users.map((u) => (
            <tr key={u.id} className="border-t border-[#2A2A2A]" data-testid={`user-row-${u.id}`}>
              <td className="px-4 py-3">@{u.username}</td>
              <td className="px-4 py-3 text-neutral-400 font-mono text-xs">{u.email}</td>
              <td className="px-4 py-3 font-mono text-xs">{u.role}</td>
              <td className="px-4 py-3 font-mono text-[#CCFF00]">${u.balance?.toFixed(2)}</td>
              <td className="px-4 py-3 font-mono text-xs">{u.sales_count || 0}</td>
              <td className="px-4 py-3 font-mono text-xs">{u.trust_score || 0}</td>
              <td className="px-4 py-3 text-right">
                {u.role === "user" && (
                  <button onClick={() => ban(u.id)} className="lootra-btn-secondary !py-1 !px-2 text-xs inline-flex items-center gap-1 !text-[#FF453A] !border-[#FF453A]" data-testid={`ban-${u.id}`}>
                    <Ban className="w-3 h-3" /> Ban
                  </button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}

      {tab === "audit" && (
        <div className="lootra-card overflow-hidden">
          <div className="font-mono text-xs">
            {audit.map((a) => (
              <div key={a.id} className="px-4 py-2 border-b border-[#2A2A2A] flex gap-4 items-center">
                <span className="text-neutral-500 w-44 shrink-0">{new Date(a.created_at).toLocaleString()}</span>
                <span className="text-[#CCFF00] w-40 shrink-0">{a.action}</span>
                <span className="text-neutral-400 truncate">{a.target}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {vault && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setVault(null)}>
          <div onClick={(e) => e.stopPropagation()} className="lootra-card max-w-lg w-full p-6">
            <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500 mb-3">Vault — listing {vault.id.slice(0,8)}</div>
            <pre className="bg-[#0A0A0A] border border-[#2A2A2A] p-4 font-mono text-xs text-[#CCFF00] overflow-x-auto">{JSON.stringify(vault.credentials, null, 2)}</pre>
            <div className="flex justify-end mt-4">
              <button onClick={() => setVault(null)} className="lootra-btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Table({ head, children }) {
  return (
    <div className="lootra-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[#1A1A1A] text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500">
          <tr>{head.map((h) => <th key={h} className="text-left px-4 py-3">{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
