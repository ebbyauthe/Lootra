import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Check, X, RefreshCw, Eye, Ban, ChevronLeft, ChevronRight, MessageSquare } from "lucide-react";
import { api, formatError } from "../lib/api";

export default function AdminDashboard() {
  const [tab, setTab] = useState("pending");
  const [stats, setStats] = useState({});
  const [pending, setPending] = useState([]);
  const [active, setActive] = useState([]);
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [audit, setAudit] = useState([]);
  const [disputed, setDisputed] = useState([]);
  const [vault, setVault] = useState(null);
  const [preview, setPreview] = useState(null);
  const [settleModal, setSettleModal] = useState(null);
  const [settleNote, setSettleNote] = useState("");
  const [settling, setSettling] = useState(false);

  const load = async () => {
    const safe = async (fn) => { try { return await fn(); } catch (e) { toast.error(formatError(e)); return null; } };
    const [s, p, ac, o, d, u, a] = await Promise.all([
      safe(() => api.get("/admin/stats")),
      safe(() => api.get("/admin/listings", { params: { status: "pending" } })),
      safe(() => api.get("/admin/listings", { params: { status: "active" } })),
      safe(() => api.get("/admin/orders")),
      safe(() => api.get("/admin/orders", { params: { status: "DISPUTED" } })),
      safe(() => api.get("/admin/users")),
      safe(() => api.get("/admin/audit", { params: { limit: 100 } })),
    ]);
    if (s) setStats(s.data);
    if (p && Array.isArray(p.data)) setPending(p.data);
    if (ac && Array.isArray(ac.data)) setActive(ac.data);
    if (o && Array.isArray(o.data)) setOrders(o.data);
    if (d && Array.isArray(d.data)) setDisputed(d.data);
    if (u && Array.isArray(u.data)) setUsers(u.data);
    if (a && Array.isArray(a.data)) setAudit(a.data);
  };
  useEffect(() => { load(); }, []);

  const approve = async (id) => { try { await api.post(`/admin/listings/${id}/approve`); toast.success("Approved"); load(); } catch (e) { toast.error(formatError(e)); } };
  const reject = async (id) => { try { await api.post(`/admin/listings/${id}/reject`); toast.success("Rejected"); load(); } catch (e) { toast.error(formatError(e)); } };
  const refund = async (id) => { try { await api.post(`/admin/orders/${id}/refund`); toast.success("Refunded"); load(); } catch (e) { toast.error(formatError(e)); } };
  const ban = async (id) => { try { await api.post(`/admin/users/${id}/ban`); toast.success("User banned"); load(); } catch (e) { toast.error(formatError(e)); } };
  const peekVault = async (id) => {
    try { const { data } = await api.get(`/admin/vault/${id}`); setVault({ id, ...data }); }
    catch (e) { toast.error(formatError(e)); }
  };

  const settle = async (action) => {
    setSettling(true);
    try {
      await api.post(`/admin/orders/${settleModal.order.id}/settle`, { action, note: settleNote });
      toast.success(action === "release" ? "Funds released to seller" : "Buyer refunded");
      setSettleModal(null); setSettleNote("");
      load();
    } catch (e) { toast.error(formatError(e)); }
    finally { setSettling(false); }
  };

  const TABS = [
    { id: "pending", label: "Pending", count: pending.length },
    { id: "active", label: "Active listings", count: active.length },
    { id: "disputed", label: "Disputes", count: disputed.length },
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
        <button onClick={load} className="lootra-btn-secondary inline-flex items-center gap-2" data-testid="admin-refresh"><RefreshCw className="w-4 h-4" /> Refresh</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="admin-stats">
        {[
          ["Users", stats.users || 0, "users"],
          ["Pending", stats.listings_pending || 0, "pending"],
          ["Active", stats.listings_active || 0, "active"],
          ["Orders", stats.orders_total || 0, "orders"],
          ["Held", stats.orders_held || 0, "orders"],
          ["Disputed", stats.orders_disputed || 0, "disputed"],
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
                <button onClick={() => setPreview(l)} className="lootra-btn-secondary !py-1 !px-2 inline-flex items-center gap-1 text-xs"><Eye className="w-3 h-3" /> Preview</button>
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

      {tab === "disputed" && (
        <div className="space-y-4">
          {disputed.length === 0 ? (
            <div className="border border-dashed border-[#2A2A2A] p-12 text-center text-sm text-neutral-500 font-mono">
              No disputed orders. All clear.
            </div>
          ) : disputed.map((o) => (
            <div key={o.id} className="lootra-card p-5 space-y-3">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="font-mono text-xs text-neutral-500">#{o.id.slice(0, 8)}</div>
                  <div className="font-medium mt-1">{o.listing_snapshot?.title}</div>
                  <div className="text-xs text-neutral-400 mt-0.5">
                    Buyer: @{o.buyer_username} · Seller: @{o.seller_username} ·{" "}
                    <span className="text-[#CCFF00] font-mono">${o.amount.toFixed(2)}</span>
                  </div>
                  {o.dispute_reason && (
                    <div className="mt-2 text-xs text-red-400 bg-red-500/5 border border-red-500/20 p-2 leading-relaxed">
                      <span className="font-semibold">Dispute reason:</span> {o.dispute_reason}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Link to={`/orders/${o.id}`} className="lootra-btn-secondary !py-1 !px-2 text-xs inline-flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> View chat
                  </Link>
                  <button
                    onClick={() => { setSettleModal({ order: o }); setSettleNote(""); }}
                    className="lootra-btn-primary !py-1 !px-2 text-xs inline-flex items-center gap-1"
                    data-testid={`settle-${o.id}`}
                  >
                    <Check className="w-3 h-3" /> Settle
                  </button>
                </div>
              </div>
              {o.timeline && o.timeline.length > 0 && (
                <div className="border-t border-[#2A2A2A] pt-3 space-y-1 font-mono text-xs text-neutral-500">
                  {o.timeline.slice(-3).map((t, i) => (
                    <div key={i}>{new Date(t.at).toLocaleString()} — {t.note}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
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

      {preview && <ListingPreviewModal listing={preview} onClose={() => setPreview(null)} onApprove={() => { approve(preview.id); setPreview(null); }} onReject={() => { reject(preview.id); setPreview(null); }} />}

      {settleModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSettleModal(null)}>
          <div onClick={(e) => e.stopPropagation()} className="lootra-card max-w-lg w-full p-6">
            <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500 mb-1">Settle dispute</div>
            <div className="font-medium mb-1">{settleModal.order.listing_snapshot?.title}</div>
            <div className="text-xs text-neutral-400 mb-4 font-mono">
              Order #{settleModal.order.id.slice(0, 8)} · ${settleModal.order.amount.toFixed(2)} · Buyer: @{settleModal.order.buyer_username} · Seller: @{settleModal.order.seller_username}
            </div>
            <div className="text-xs text-neutral-500 mb-2 font-mono">Optional note (added to order timeline)</div>
            <textarea
              className="lootra-input min-h-[80px] mb-5"
              value={settleNote}
              onChange={(e) => setSettleNote(e.target.value)}
              placeholder="Note for the timeline (optional)…"
            />
            <div className="flex gap-2">
              <button onClick={() => settle("release")} disabled={settling} className="lootra-btn-primary flex-1 inline-flex items-center justify-center gap-2">
                <Check className="w-4 h-4" /> Release to seller
              </button>
              <button onClick={() => settle("refund")} disabled={settling} className="flex-1 py-2 px-4 border border-[#FF453A] text-[#FF453A] hover:bg-[#FF453A]/10 transition-colors font-mono text-sm inline-flex items-center justify-center gap-2">
                <X className="w-4 h-4" /> Refund buyer
              </button>
            </div>
            <div className="flex justify-end mt-3">
              <button onClick={() => setSettleModal(null)} className="lootra-btn-secondary">Cancel</button>
            </div>
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

function ListingPreviewModal({ listing, onClose, onApprove, onReject }) {
  const [imgIdx, setImgIdx] = useState(0);
  const screenshots = listing.screenshots || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="lootra-card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-[#2A2A2A]">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500 mb-1">Pending review</div>
            <div className="font-medium text-white">{listing.title}</div>
            <div className="text-xs text-neutral-400 mt-0.5">{listing.game} · @{listing.seller_username} · <span className="text-[#CCFF00] font-mono">${listing.price?.toFixed(2)}</span></div>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Screenshots */}
          {screenshots.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500 mb-2">Screenshots ({screenshots.length})</div>
              <div className="relative bg-[#0A0A0A] border border-[#2A2A2A]">
                <img src={screenshots[imgIdx]} alt="" className="w-full aspect-video object-contain" />
                {screenshots.length > 1 && (
                  <div className="absolute inset-y-0 flex items-center justify-between w-full px-2 pointer-events-none">
                    <button onClick={() => setImgIdx(i => Math.max(0, i - 1))} className="pointer-events-auto bg-black/60 p-1 hover:bg-black/80 transition-colors disabled:opacity-30" disabled={imgIdx === 0}>
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button onClick={() => setImgIdx(i => Math.min(screenshots.length - 1, i + 1))} className="pointer-events-auto bg-black/60 p-1 hover:bg-black/80 transition-colors disabled:opacity-30" disabled={imgIdx === screenshots.length - 1}>
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
              {screenshots.length > 1 && (
                <div className="flex gap-1.5 mt-2 overflow-x-auto no-scrollbar">
                  {screenshots.map((s, i) => (
                    <button key={i} onClick={() => setImgIdx(i)} className={`shrink-0 w-20 aspect-video border ${i === imgIdx ? "border-[#CCFF00]" : "border-[#2A2A2A]"}`}>
                      <img src={s} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Details */}
          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            {[
              ["Game", listing.game],
              ["Platform", listing.platform],
              ["Price", `$${listing.price?.toFixed(2)}`],
              ["Seller", `@${listing.seller_username}`],
              ["Submitted", new Date(listing.created_at).toLocaleString()],
              ["Region", listing.region || "—"],
            ].map(([k, v]) => (
              <div key={k} className="bg-[#0A0A0A] border border-[#2A2A2A] p-3">
                <div className="text-neutral-500 text-[10px] uppercase tracking-wider mb-1">{k}</div>
                <div className="text-white">{v}</div>
              </div>
            ))}
          </div>

          {/* Description */}
          {listing.description && (
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500 mb-2">Description</div>
              <div className="bg-[#0A0A0A] border border-[#2A2A2A] p-3 text-sm text-neutral-300 whitespace-pre-wrap leading-relaxed">{listing.description}</div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button onClick={onApprove} className="lootra-btn-primary flex-1 inline-flex items-center justify-center gap-2">
              <Check className="w-4 h-4" /> Approve
            </button>
            <button onClick={onReject} className="flex-1 py-2 px-4 border border-[#FF453A] text-[#FF453A] hover:bg-[#FF453A]/10 transition-colors font-mono text-sm inline-flex items-center justify-center gap-2">
              <X className="w-4 h-4" /> Reject
            </button>
          </div>
        </div>
      </div>
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
