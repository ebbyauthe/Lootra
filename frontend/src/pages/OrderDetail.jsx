import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { Eye, EyeOff, CheckCircle, AlertTriangle, Star } from "lucide-react";
import { api, formatError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import EscrowStepper from "../components/EscrowStepper";

export default function OrderDetail() {
  const { id } = useParams();
  const { user, refresh } = useAuth();
  const [order, setOrder] = useState(null);
  const [creds, setCreds] = useState(null);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [review, setReview] = useState({ rating: 5, comment: "" });

  const load = async () => {
    try {
      const { data } = await api.get(`/orders/${id}`);
      setOrder(data);
    } catch (e) { toast.error(formatError(e)); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const reveal = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/orders/${id}/reveal`);
      setCreds(data.credentials);
      setShow(true);
      toast.success("Credentials revealed");
      await load();
    } catch (e) { toast.error(formatError(e)); }
    finally { setBusy(false); }
  };

  const confirm = async () => {
    setBusy(true);
    try {
      await api.post(`/orders/${id}/confirm`);
      toast.success("Funds released to seller");
      await load();
    } catch (e) { toast.error(formatError(e)); }
    finally { setBusy(false); }
  };

  const dispute = async () => {
    if (reason.length < 10) { toast.error("Please describe the issue (min 10 chars)"); return; }
    setBusy(true);
    try {
      await api.post(`/orders/${id}/dispute`, { reason });
      toast.success("Dispute opened — admin notified");
      setDisputeOpen(false); setReason("");
      await load();
    } catch (e) { toast.error(formatError(e)); }
    finally { setBusy(false); }
  };

  const submitReview = async () => {
    setBusy(true);
    try {
      await api.post(`/orders/${id}/review`, review);
      toast.success("Review submitted");
      setReviewOpen(false);
    } catch (e) { toast.error(formatError(e)); }
    finally { setBusy(false); }
  };

  if (!order) return <div className="font-mono text-xs text-neutral-500">Loading order…</div>;

  const isBuyer = user?.id === order.buyer_id;

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto" data-testid="order-detail">
      <div>
        <div className="lootra-badge inline-block mb-3">ORDER #{order.id.slice(0,8)}</div>
        <h1 className="text-3xl font-medium tracking-tight">{order.listing_snapshot?.title}</h1>
        <div className="flex flex-wrap gap-3 mt-3 text-sm text-neutral-400 font-mono">
          <span>Amount: <span className="text-[#CCFF00]">${order.amount.toFixed(2)}</span></span>
          <span>·</span>
          <span>Buyer @{order.buyer_username}</span>
          <span>·</span>
          <span>Seller @{order.seller_username}</span>
        </div>
      </div>

      <EscrowStepper status={order.status} />

      {/* Buyer actions */}
      {isBuyer && (
        <div className="lootra-card p-6 space-y-4">
          <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500">Vault</div>
          {!creds ? (
            <>
              <p className="text-sm text-neutral-400">Click below to reveal encrypted account credentials. This action is logged.</p>
              <button onClick={reveal} disabled={busy || order.status === "REFUNDED"} className="lootra-btn-primary inline-flex items-center gap-2" data-testid="reveal-credentials-btn">
                <Eye className="w-4 h-4" /> Reveal credentials
              </button>
            </>
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
              <button onClick={() => setDisputeOpen(true)} className="lootra-btn-secondary inline-flex items-center gap-2" data-testid="dispute-order-btn">
                <AlertTriangle className="w-4 h-4" /> Open dispute
              </button>
            </div>
          )}

          {order.status === "RELEASED" && (
            <div className="pt-3 border-t border-[#2A2A2A]">
              <button onClick={() => setReviewOpen(true)} className="lootra-btn-secondary inline-flex items-center gap-2" data-testid="leave-review-btn"><Star className="w-4 h-4" /> Leave review</button>
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
      <div className="lootra-card p-6">
        <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500 mb-3">Activity log</div>
        <div className="space-y-3 font-mono text-xs">
          {order.timeline?.map((t, i) => (
            <div key={i} className="flex gap-4 border-l-2 border-[#CCFF00] pl-4">
              <span className="text-neutral-500">{new Date(t.at).toLocaleString()}</span>
              <span className="text-[#CCFF00]">{t.status}</span>
              <span className="text-neutral-300">{t.note}</span>
            </div>
          ))}
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

      {reviewOpen && (
        <Modal onClose={() => setReviewOpen(false)} title="Leave a review">
          <div className="space-y-3">
            <div className="flex gap-2">
              {[1,2,3,4,5].map((r) => (
                <button key={r} onClick={() => setReview({ ...review, rating: r })}
                  className={`w-10 h-10 border ${review.rating >= r ? "border-[#CCFF00] bg-[rgba(204,255,0,0.1)] text-[#CCFF00]" : "border-[#2A2A2A] text-neutral-500"}`}
                  data-testid={`rating-${r}`}>
                  <Star className={`w-4 h-4 mx-auto ${review.rating >= r ? "fill-current" : ""}`} />
                </button>
              ))}
            </div>
            <textarea className="lootra-input min-h-[100px]" placeholder="How was the trade?" value={review.comment} onChange={(e) => setReview({ ...review, comment: e.target.value })} data-testid="review-comment" />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setReviewOpen(false)} className="lootra-btn-secondary">Cancel</button>
            <button onClick={submitReview} disabled={busy} className="lootra-btn-primary" data-testid="review-submit">Submit</button>
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
          <button onClick={onClose} className="text-neutral-400 hover:text-white">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
