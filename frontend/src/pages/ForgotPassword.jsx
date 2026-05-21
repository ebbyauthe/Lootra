import React, { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle } from "lucide-react";
import { api, formatError } from "../lib/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      toast.error(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="max-w-md mx-auto py-12 animate-fade-in">
        <div className="lootra-card p-8 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-[#CCFF00]/10 border-2 border-[#CCFF00] flex items-center justify-center">
            <CheckCircle className="w-7 h-7 text-[#CCFF00]" />
          </div>
          <div>
            <div className="text-lg font-medium text-white">Check your email</div>
            <div className="text-sm text-neutral-400 mt-2">
              If <span className="text-white font-mono">{email}</span> has an account, a reset link has been sent. Check your spam folder if you don't see it.
            </div>
          </div>
          <Link to="/login" className="text-sm text-neutral-500 hover:text-white transition-colors mt-2">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-12 animate-fade-in">
      <div className="lootra-badge inline-block mb-3">ACCESS</div>
      <h1 className="text-3xl font-medium tracking-tight mb-2">Forgot password?</h1>
      <p className="text-sm text-neutral-400 mb-8">Enter your email and we'll send you a reset link.</p>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500 block mb-2">Email</label>
          <input
            type="email"
            className="lootra-input"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
        </div>
        <button type="submit" disabled={busy} className="lootra-btn-primary w-full">
          {busy ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <div className="text-sm text-neutral-500 mt-6">
        <Link to="/login" className="hover:text-white transition-colors">← Back to sign in</Link>
      </div>
    </div>
  );
}
