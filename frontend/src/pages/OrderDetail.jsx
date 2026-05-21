import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { Eye, EyeOff, CheckCircle, AlertTriangle, Star, Send, Shield, Lock, Image, X } from "lucide-react";
import { api, formatError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import EscrowStepper from "../components/EscrowStepper";

const STATUS_COLOR = {
  PAID: "text-yellow-400", DELIVERED: "text-blue-400", CONFIRMED: "text-green-400",
  RELEASED: "text-[#CCFF00]", DISPUTED: "text-red-400", REFUNDED: "text-neutral-400",
};

function useCountdown(deadline) {
  const [remaining, setRemaining] = useState(null);
  useEffect(() => {
    if (!deadline) return;
    const tick = () => {
      const diff = new Date(deadline) - new Date();
      setRemaining(Math.max(0, Math.floor(diff / 1000)));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [deadline]);
  return remaining;
}

function formatCountdown(secs) {
  if (secs === null) return "--:--";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function CircleTimer({ remaining, total }) {
  const SIZE = 96;
  const STROKE = 6;
  const r = (SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * r;
  const fraction = remaining === null ? 1 : Math.max(0, remaining / total);
  const offset = circumference * (1 - fraction);
  const color = fraction > 0.5 ? "#CCFF00" : fraction > 0.2 ? "#facc15" : "#ef4444";

  return (
    <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={r} fill="none" stroke="#2A2A2A" strokeWidth={STROKE} />
        <circle
          cx={SIZE / 2} cy={SIZE / 2} r={r}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="font-mono text-sm font-bold leading-none" style={{ color }}>
          {formatCountdown(remaining)}
        </span>
        <span className="font-mono text-[9px] text-neutral-600 mt-1">left</span>
      </div>
    </div>
  );
}

export default function OrderDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgText, setMsgText] = useState("");
  const [msgImage, setMsgImage] = useState(null);
  const [creds, setCreds] = useState(null);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [complaintOpen, setComplaintOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmScreenshot, setConfirmScreenshot] = useState(null);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [score, setScore] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [rated, setRated] = useState(false);
  const chatRef = useRef(null);
  const pollRef = useRef(null);
  const fileRef = useRef(null);
  const confirmFileRef = useRef(null);

  const loadOrder = useCallback(async () => {
    try { const { data } = await api.get(`/orders/${id}`); setOrder(data); } catch (e) { toast.error(formatError(e)); }
  }, [id]);

  const loadMessages = useCallback(async () => {
    try { const { data } = await api.get(`/orders/${id}/messages`); if (Array.isArray(data)) setMessages(data); } catch {}
  }, [id]);

  useEffect(() => {
    loadOrder();
    loadMessages();
    pollRef.current = setInterval(() => { loadMessages(); loadOrder(); }, 5000);
    return () => clearInterval(pollRef.current);
  }, [loadOrder, loadMessages]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const toBase64 = (file) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

  const handleImagePick = async (e, setter) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { toast.error("Image must be under 3MB"); return; }
    const b64 = await toBase64(file);
    setter(b64);
  };

  const sendMsg = async (e) => {
    e.preventDefault();
    if (!msgText.trim() && !msgImage) return;
    setSending(true);
    try {
      const { data } = await api.post(`/orders/${id}/messages`, { content: msgText.trim(), image: msgImage });
      setMessages((m) => [...m, data]);
      setMsgText("");
      setMsgImage(null);
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
    try {
      await api.post(`/orders/${id}/confirm`, { screenshot: confirmScreenshot });
      toast.success("Account secured — 24-hour complaint window started");
      setConfirmOpen(false); setConfirmScreenshot(null);
      await loadOrder();
    } catch (e) { toast.error(formatError(e)); }
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

  const complaint = async () => {
    if (reason.length < 10) { toast.error("Describe the issue (min 10 chars)"); return; }
    setBusy(true);
    try {
      await api.post(`/orders/${id}/complaint`, { reason });
      toast.success("Complaint raised — admin will review");
      setComplaintOpen(false); setReason(""); await loadOrder();
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

  const isBuyer = user?.id === order?.buyer_id;
  const isSeller = user?.id === order?.seller_id;
  const isAdmin = user?.role === "admin";
  const counterparty = isBuyer ? `@${order?.seller_username}` : `@${order?.buyer_username}`;
  const counterpartyUsername = isBuyer ? order?.seller_username : order?.buyer_username;
  const tradeDone = ["RELEASED", "REFUNDED"].includes(order?.status);
  const canRate = tradeDone && !rated && (isBuyer || isSeller);
  const inHandover = ["PAID", "DELIVERED"].includes(order?.status);
  const isConfirmed = order?.status === "CONFIRMED";
  const complaintWindowOpen = isConfirmed && order?.complaint_window_until && new Date(order.complaint_window_until) > new Date();

  const handoverSecs = useCountdown(inHandover ? order?.handover_deadline : null);
  const complaintSecs = useCountdown(complaintWindowOpen ? order?.complaint_window_until : null);

  if (!order) return <div className="font-mono text-xs text-neutral-500 p-12">Loading order…</div>;

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
            {!isAdmin && <Link to={`/user/${counterpartyUsername}`} className="hover:text-white hover:underline">{counterparty}</Link>}
            {isAdmin && <span>Buyer: @{order.buyer_username} · Seller: @{order.seller_username}</span>}
          </div>
        </div>
        {canRate && (
          <button onClick={() => setRatingOpen(true)} className="lootra-btn-secondary inline-flex items-center gap-2 text-sm">
            <Star className="w-4 h-4" /> Rate this trade
          </button>
        )}
      </div>

      {/* Handover countdown */}
      {inHandover && handoverSecs !== null && (
        <div className={`border p-5 flex items-center gap-5 ${handoverSecs < 300 ? "border-red-500/30 bg-red-500/5" : handoverSecs < 1200 ? "border-yellow-500/30 bg-yellow-500/5" : "border-[#CCFF00]/20 bg-[#CCFF00]/5"}`}>
          <CircleTimer remaining={handoverSecs} total={65 * 60} />
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-neutral-500 mb-1">Handover window</div>
            <div className="font-medium text-white text-sm">Seller must hand over the account before time runs out.</div>
            <div className="text-xs text-neutral-500 mt-1 leading-relaxed">
              {handoverSecs === 0
                ? "Time expired — dispute auto-triggered."
                : "If time expires without handover, the dispute is auto-triggered and the buyer is refunded."}
            </div>
          </div>
        </div>
      )}

      {/* Complaint window countdown */}
      {complaintWindowOpen && complaintSecs !== null && isBuyer && (
        <div className="border border-blue-500/30 bg-blue-500/5 p-5 flex items-center gap-5">
          <CircleTimer remaining={complaintSecs} total={24 * 60 * 60} />
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-neutral-500 mb-1">Complaint window</div>
            <div className="font-medium text-white text-sm">You have 24 hours to raise a complaint.</div>
            <div className="text-xs text-neutral-500 mt-1 leading-relaxed">
              If the seller reclaims the account after you confirmed, raise a complaint before this window closes.
            </div>
          </div>
        </div>
      )}

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

                {["PAID", "DELIVERED"].includes(order.status) && (
                  <div className="flex flex-wrap gap-2 pt-3 border-t border-[#2A2A2A]">
                    <button onClick={() => setConfirmOpen(true)} disabled={busy} className="lootra-btn-primary inline-flex items-center gap-2" data-testid="confirm-order-btn">
                      <CheckCircle className="w-4 h-4" /> I've secured the account
                    </button>
                    <button onClick={() => setDisputeOpen(true)} className="lootra-btn-secondary inline-flex items-center gap-2 !border-red-500/50 !text-red-400" data-testid="dispute-order-btn">
                      <AlertTriangle className="w-4 h-4" /> Dispute
                    </button>
                  </div>
                )}

                {complaintWindowOpen && (
                  <div className="pt-3 border-t border-[#2A2A2A]">
                    <button onClick={() => { setReason(""); setComplaintOpen(true); }} className="lootra-btn-secondary inline-flex items-center gap-2 !border-red-500/50 !text-red-400 text-sm">
                      <AlertTriangle className="w-4 h-4" /> Raise a complaint
                    </button>
                    <p className="text-xs text-neutral-500 mt-2">Use this if the seller reclaimed the account after you confirmed.</p>
                  </div>
                )}
              </>
            )}

            {isSeller && (
              <div className="text-sm text-neutral-400 space-y-2">
                <p>Credentials are held in the encrypted vault. Work with the buyer in chat to complete the handover.</p>
                {order.status === "PAID" && <p className="text-yellow-400 font-mono text-xs">⏳ Buyer has not revealed credentials yet. Help them via chat.</p>}
                {order.status === "DELIVERED" && <p className="text-blue-400 font-mono text-xs">👁 Buyer revealed credentials — assist with verification codes in chat.</p>}
                {order.status === "CONFIRMED" && <p className="text-green-400 font-mono text-xs">✓ Buyer confirmed access. Funds release after 24h complaint window.</p>}
                {order.status === "RELEASED" && <p className="text-[#CCFF00] font-mono text-xs">✓ Funds released to your wallet.</p>}
              </div>
            )}

            {isAdmin && (
              <div className="text-sm text-neutral-400">
                <p className="font-mono text-xs text-[#CCFF00] mb-2">Admin view — oversee handover and settle disputes from the admin dashboard.</p>
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
              ...(order.handover_deadline ? [["Handover deadline", new Date(order.handover_deadline).toLocaleString()]] : []),
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
              {isAdmin ? "A" : counterpartyUsername?.[0]?.toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-medium">{isAdmin ? "Order chat" : counterparty}</div>
              <div className="text-[10px] text-neutral-500 font-mono">{tradeDone ? "Trade complete" : "Buyer · Seller · Admin"}</div>
            </div>
            <Shield className="w-4 h-4 text-[#CCFF00] ml-auto" />
          </div>

          <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs">
            {messages.length === 0 && (
              <div className="text-center text-neutral-600 pt-8">
                <Shield className="w-8 h-8 mx-auto mb-2 text-neutral-700" />
                <div>3-way trade chat</div>
                <div className="text-[10px] mt-1 text-neutral-700">Buyer, seller and admin can all message here.</div>
              </div>
            )}
            {messages.map((m) => {
              const isMe = m.sender_id === user?.id;
              return (
                <div key={m.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                  <div className={`max-w-[80%] px-3 py-2 text-xs leading-relaxed ${
                    m.is_admin ? "bg-[rgba(204,255,0,0.1)] border border-[rgba(204,255,0,0.3)] text-[#CCFF00]"
                    : isMe ? "bg-[#1E1E1E] text-neutral-100"
                    : "bg-[#141414] text-neutral-300"
                  }`}>
                    {!isMe && <div className="text-[10px] text-neutral-500 mb-1">{m.is_admin ? "🛡 Admin" : `@${m.sender_username}`}</div>}
                    {m.content && <div>{m.content}</div>}
                    {m.image && (
                      <img
                        src={m.image}
                        alt="screenshot"
                        className="mt-2 max-w-full rounded cursor-pointer"
                        onClick={() => window.open(m.image, "_blank")}
                      />
                    )}
                  </div>
                  <div className="text-[10px] text-neutral-600 mt-1">{new Date(m.created_at).toLocaleTimeString()}</div>
                </div>
              );
            })}
          </div>

          {/* Image preview */}
          {msgImage && (
            <div className="px-3 pt-2 border-t border-[#2A2A2A] flex items-center gap-2">
              <img src={msgImage} alt="preview" className="h-14 object-cover" />
              <button onClick={() => setMsgImage(null)} className="text-neutral-500 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
          )}

          {tradeDone ? (
            <div className="p-4 border-t border-[#2A2A2A] text-center text-xs text-neutral-600 font-mono">
              Chat closed — trade complete
            </div>
          ) : (
            <form onSubmit={sendMsg} className="p-3 border-t border-[#2A2A2A] flex gap-2">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleImagePick(e, setMsgImage)} />
              <button type="button" onClick={() => fileRef.current?.click()} className="lootra-btn-secondary !py-2 !px-2 shrink-0">
                <Image className="w-4 h-4" />
              </button>
              <input
                className="lootra-input flex-1 !py-2 text-sm"
                placeholder="Message…"
                value={msgText}
                onChange={(e) => setMsgText(e.target.value)}
                disabled={sending}
              />
              <button type="submit" disabled={sending || (!msgText.trim() && !msgImage)} className="lootra-btn-primary !py-2 !px-3">
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Confirm modal */}
      {confirmOpen && (
        <Modal onClose={() => { setConfirmOpen(false); setConfirmScreenshot(null); }} title="Confirm account secured">
          <p className="text-sm text-neutral-400 mb-4">Upload a screenshot showing you have access to the account. This starts the 24-hour complaint window before funds are released.</p>
          <input ref={confirmFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleImagePick(e, setConfirmScreenshot)} />
          {confirmScreenshot ? (
            <div className="relative mb-4">
              <img src={confirmScreenshot} alt="confirmation" className="w-full max-h-48 object-contain border border-[#2A2A2A]" />
              <button onClick={() => setConfirmScreenshot(null)} className="absolute top-2 right-2 bg-black/70 p-1 text-neutral-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <button onClick={() => confirmFileRef.current?.click()} className="lootra-btn-secondary w-full inline-flex items-center justify-center gap-2 mb-4">
              <Image className="w-4 h-4" /> Upload screenshot (optional)
            </button>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={() => { setConfirmOpen(false); setConfirmScreenshot(null); }} className="lootra-btn-secondary">Cancel</button>
            <button onClick={confirm} disabled={busy} className="lootra-btn-primary" data-testid="confirm-order-btn">Confirm — I've secured the account</button>
          </div>
        </Modal>
      )}

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

      {/* Complaint modal */}
      {complaintOpen && (
        <Modal onClose={() => setComplaintOpen(false)} title="Raise a complaint">
          <p className="text-sm text-neutral-400 mb-3">Describe what happened after you confirmed. Admin will review the chat history and screenshots.</p>
          <textarea className="lootra-input min-h-[120px]" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setComplaintOpen(false)} className="lootra-btn-secondary">Cancel</button>
            <button onClick={complaint} disabled={busy} className="lootra-btn-primary">Submit complaint</button>
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
