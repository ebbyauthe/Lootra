import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { Eye, EyeOff, CheckCircle, AlertTriangle, Star, Send, Shield, Lock } from "lucide-react";
import { api, formatError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import EscrowStepper from "../components/EscrowStepper";

const STATUS_COLOR = {
  PAID: "text-yellow-400", DELIVERED: "text-blue-400", CONFIRMED: "text-green-400",
  RELEASED: "text-[#CCFF00]", DISPUTED: "text-red-400", REFUNDED: "text-neutral-400",
};

export default function OrderDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgText, setMsgText] = useState("");
  const [creds, setCreds] = useState(null);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [ratingOpen, setRatingOpen] = useState(false);
  const [score, setScore] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [rated, setRated] = useState(false);
  const chatRef = useRef(null);
  const pollRef = useRef(null);

  const loadOrder = useCallback(async () => {
    try { const { data } = await api.get(`/orders/${id}`); setOrder(data); } catch (e) { toast.error(formatError(e)); }
  }, [id]);

  const loadMessages = useCallback(async () => {
    try { const { data } = await api.get(`/orders/${id}/messages`); if (Array.isArray(data)) setMessages(data); } catch {}
  }, [id]);

  useEffect(() => {
    loadOrder();
    loadMessages();
    pollRef.current = setInterval(loadMessages, 5000);
    return () => clearInterval(pollRef.current);
  }, [loadOrder, loadMessages]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const sendMsg = async (e) => {
    e.preventDefault();
    if (!msgText.trim()) return;
    setSending(true);
    try {
      const { data } = await api.post(`/orders/${id}/messages`, { content: msgText.trim() });
      setMessages((m) => [...m, data]);
      setMsgText("");
    } catch (e) { toast.error(formatError(e)); }
    finally { setSending(false); }
  };

  const reveal = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/orders/${id}/reveal`);
      setCreds(data.credentials); setShow(true);
      toast.success("Credentials revealed");
      await loadOrder();
    } catch (e) { toast.error(formatError(e)); }
    finally { setBusy(false); }
  };

  const confirm = async () => {
    setBusy(true);
    try { await api.post(`/orders/${id}/confirm`); toast.success("Funds released to seller"); await loadOrder(); }
    catch (e) { toast.error(formatError(e)); }
    finally { setBusy(false); }
  };

  const dispute = async () => {
    if (reason.length < 10) { toast.error("Describe the issue (min 10 chars)"); return; }
    setBusy(true);
    try {
      await api.post(`/orders/${id}/dispute`, { reason });
      toast.success("Dispute opened — admin notified");
      setDisputeOpen(false); setReason(""); await loadOrder();
    } catch (e) { toast.error(formatError(e)); }
    finally { setBusy(false); }
  };

  const submitRating = async () => {
    setBusy(true);
    try {
      await api.post(`/orders/${id}/rate`, { score, comment: ratingComment });
      toast.success("Rating submitted");
      setRatingOpen(false); setRated(true);
    } catch (e) { toast.error(formatError(e)); }
    finally { setBusy(false); }
  };

  if (!order) return <div className="font-mono text-xs text-neutral-500 p-12">Loading order…</div>;

  const isBuyer = user?.id === order.buyer_id;
  const isSeller = user?.id === order.seller_id;
  const counterparty = isBuyer ? `@${order.seller_username}` : `@${order.buyer_username}`;
  const counterpartyUsername = isBuyer ? order.seller_username : order.buyer_username;
  const tradeDone = ["RELEASED", "REFUNDED"].includes(order.status);
  const canRate = tradeDone && !rated && (isBuyer || isSeller);

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in" data-testid="order-detail">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="lootra-badge inline-block mb-2">ORDER #{order.id.slice(0, 8)}</div>
          <h1 className="text-2xl md:text-3xl font-medium tracking-tight">{order.listing_snapshot?.title}</h1>
          <div className="flex flex-wrap gap-3 mt-2 text-sm text-neutral-400 font-mono">
            <span className={`font-semibold ${STATUS_COLOR[order.status] || ""}`}>{order.status}</span>
            <span>·</span>
            <span className="text-[#CCFF00]">${order.amount?.toFixed(2)}</span>
            <span>·</span>
            <Link to={`/user/${counterpartyUsername}`} className="hover:text-white hover:underline">{counterparty}</Link>
          </div>
        </div>
        {canRate && (
          <button onClick={() => setRatingOpen(true)} className="lootra-btn-secondary inline-flex items-center gap-2 text-sm">
            <Star className="w-4 h-4" /> Rate this trade
          </button>
        )}
      </div>

      <EscrowStepper status={order.status} />

      {/* P2P Layout */}
      <div className="grid lg:grid-cols-[1fr_380px] gap-6">
        {/* Left: order info + actions */}
        <div className="space-y-4">
          {/* Vault / actions card */}
          <div className="lootra-card p-6 space-y-4">
            <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500 flex items-center gap-2">
              <Lock className="w-3 h-3" /> Credentials vault
            </div>

            {isBuyer && (
              <>
                {!creds ? (
                  <div className="space-y-3">
                    <p className="text-sm text-neutral-400">Reveal the seller's encrypted credentials. This action is audited.</p>
                    <button onClick={reveal} disabled={busy || order.status === "REFUNDED"} className="lootra-btn-primary inline-flex items-center gap-2" data-testid="reveal-credentials-btn">
                      <Eye className="w-4 h-4" /> Reveal credentials
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3" data-testid="credentials-block">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-400 font-mono">Decrypted credentials</span>
                      <button onClick={() => setShow(!show)} className="text-xs text-[#CCFF00] inline-flex items-center gap-1" data-testid="toggle-credentials">
                        {show ? <><EyeOff className="w-3 h-3" /> Hide</> : <><Eye className="w-3 h-3" /> Show</>}
                      </button>
                    </div>
                    <pre className="bg-[#0A0A0A] border border-[#2A2A2A] p-4 font-mono text-xs text-[#CCFF00] overflow-x-auto whitespace-pre-wrap">
                      {show ? JSON.stringify(creds, null, 2) : "••••••••••••••••\n••••••••••••••••\n••••••••••••••••"}
                    </pre>
                  </div>
                )}

                {order.status === "DELIVERED" && (
                  <div className="flex flex-wrap gap-2 pt-3 border-t border-[#2A2A2A]">
                    <button onClick={confirm} disabled={busy} className="lootra-btn-primary inline-flex items-center gap-2" data-testid="confirm-order-btn">
                      <CheckCircle className="w-4 h-4" /> Confirm access — release funds
                    </button>
                    <button onClick={() => setDisputeOpen(true)} className="lootra-btn-secondary inline-flex items-center gap-2 !border-red-500/50 !text-red-400" data-testid="dispute-order-btn">
                      <AlertTriangle className="w-4 h-4" /> Dispute
                    </button>
                  </div>
                )}
              </>
            )}

            {isSeller && (
              <div className="text-sm text-neutral-400 space-y-2">
                <p>Credentials are held in the encrypted vault until the buyer reveals them.</p>
                {order.status === "PAID" && <p className="text-yellow-400 font-mono text-xs">⏳ Waiting for buyer to reveal credentials.</p>}
                {order.status === "DELIVERED" && <p className="text-blue-400 font-mono text-xs">👁 Buyer has revealed credentials. Awaiting confirmation.</p>}
                {order.status === "RELEASED" && <p className="text-[#CCFF00] font-mono text-xs">✓ Funds released to your wallet.</p>}
              </div>
            )}
          </div>

          {/* Order details card */}
          <div className="lootra-card p-6 space-y-3">
            <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500 mb-1">Order details</div>
            {[
              ["Game", order.listing_snapshot?.game],
              ["Platform", order.listing_snapshot?.platform],
              ["Region", order.listing_snapshot?.region],
              ["Amount", `$${order.amount?.toFixed(2)}`],
              ["Buyer", `@${order.buyer_username}`],
              ["Seller", `@${order.seller_username}`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm border-b border-[#1A1A1A] pb-2">
                <span className="text-neutral-500 font-mono text-xs">{k}</span>
                <span className="text-neutral-200 font-mono text-xs">{v}</span>
              </div>
            ))}
          </div>

          {/* Timeline */}
          <div className="lootra-card p-6">
            <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500 mb-3">Activity log</div>
            <div className="space-y-3 font-mono text-xs">
              {order.timeline?.map((t, i) => (
                <div key={i} className="flex gap-3 border-l-2 border-[#CCFF00] pl-3">
                  <span className="text-neutral-500 shrink-0">{new Date(t.at).toLocaleString()}</span>
                  <span className="text-neutral-300">{t.note}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: P2P Chat */}
        <div className="lootra-card flex flex-col" style={{ height: "600px" }}>
          <div className="p-4 border-b border-[#2A2A2A] flex items-center gap-3">
            <div className="w-8 h-8 bg-[#1A1A1A] flex items-center justify-center text-xs font-mono font-bold text-[#CCFF00]">
              {counterpartyUsername?.[0]?.toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-medium">{counterparty}</div>
              <div className="text-[10px] text-neutral-500 font-mono">{tradeDone ? "Trade complete" : "Online"}</div>
            </div>
            <Shield className="w-4 h-4 text-[#CCFF00] ml-auto" />
          </div>

          <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs">
            {messages.length === 0 && (
              <div className="text-center text-neutral-600 pt-8">
                <Shield className="w-8 h-8 mx-auto mb-2 text-neutral-700" />
                <div>Encrypted trade chat</div>
                <div className="text-[10px] mt-1 text-neutral-700">Messages are private to this order.</div>
              </div>
            )}
            {messages.map((m) => {
              const isMe = m.sender_id === user?.id;
              return (
                <div key={m.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                  <div className={`max-w-[75%] px-3 py-2 text-xs leading-relaxed ${
                    m.is_admin ? "bg-[rgba(204,255,0,0.1)] border border-[rgba(204,255,0,0.3)] text-[#CCFF00]"
                    : isMe ? "bg-[#1E1E1E] text-neutral-100"
                    : "bg-[#141414] text-neutral-300"
                  }`}>
                    {!isMe && <div className="text-[10px] text-neutral-500 mb-1">{m.is_admin ? "🛡 Admin" : `@${m.sender_username}`}</div>}
                    {m.content}
                  </div>
                  <div className="text-[10px] text-neutral-600 mt-1">{new Date(m.created_at).toLocaleTimeString()}</div>
                </div>
              );
            })}
          </div>

          {tradeDone ? (
            <div className="p-4 border-t border-[#2A2A2A] text-center text-xs text-neutral-600 font-mono">
              Chat closed — trade complete
            </div>
          ) : (
            <form onSubmit={sendMsg} className="p-3 border-t border-[#2A2A2A] flex gap-2">
              <input
                className="lootra-input flex-1 !py-2 text-sm"
                placeholder="Message…"
                value={msgText}
                onChange={(e) => setMsgText(e.target.value)}
                disabled={sending}
              />
              <button type="submit" disabled={sending || !msgText.trim()} className="lootra-btn-primary !py-2 !px-3">
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Dispute modal */}
      {disputeOpen && (
        <Modal onClose={() => setDisputeOpen(false)} title="Open dispute">
          <p className="text-sm text-neutral-400 mb-3">Describe the issue. Funds will be frozen until admin reviews.</p>
          <textarea className="lootra-input min-h-[120px]" value={reason} onChange={(e) => setReason(e.target.value)} data-testid="dispute-reason" />
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setDisputeOpen(false)} className="lootra-btn-secondary">Cancel</button>
            <button onClick={dispute} disabled={busy} className="lootra-btn-primary" data-testid="dispute-submit">Open dispute</button>
          </div>
        </Modal>
      )}

      {/* Rating modal */}
      {ratingOpen && (
        <Modal onClose={() => setRatingOpen(false)} title={`Rate @${counterpartyUsername}`}>
          <div className="space-y-4">
            <div className="flex gap-2 justify-center">
              {[1, 2, 3, 4, 5].map((r) => (
                <button key={r} onClick={() => setScore(r)}
                  className={`w-10 h-10 border transition-colors ${score >= r ? "border-[#CCFF00] bg-[rgba(204,255,0,0.1)] text-[#CCFF00]" : "border-[#2A2A2A] text-neutral-500"}`}>
                  <Star className={`w-4 h-4 mx-auto ${score >= r ? "fill-current" : ""}`} />
                </button>
              ))}
            </div>
            <textarea className="lootra-input min-h-[100px]" placeholder="How was the trade? (optional)" value={ratingComment} onChange={(e) => setRatingComment(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setRatingOpen(false)} className="lootra-btn-secondary">Cancel</button>
            <button onClick={submitRating} disabled={busy} className="lootra-btn-primary">Submit rating</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, title, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="lootra-card w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500">{title}</div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white text-lg leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
