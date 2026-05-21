import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { api, formatError } from "../lib/api";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  if (!token) {
    return (
      <div className="max-w-md mx-auto py-12 animate-fade-in text-center">
        <p className="text-neutral-400 text-sm">Invalid reset link.</p>
        <Link to="/forgot-password" className="text-[#CCFF00] hover:underline text-sm mt-4 inline-block">
          Request a new one
        </Link>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { toast.error("Passwords don't match"); return; }
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    setBusy(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      toast.success("Password updated — please sign in");
      nav("/login");
    } catch (err) {
      toast.error(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 animate-fade-in">
      <div className="lootra-badge inline-block mb-3">ACCESS</div>
      <h1 className="text-3xl font-medium tracking-tight mb-2">Set new password</h1>
      <p className="text-sm text-neutral-400 mb-8">Choose a strong password for your account.</p>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500 block mb-2">New password</label>
          <input
            type="password"
            className="lootra-input"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500 block mb-2">Confirm password</label>
          <input
            type="password"
            className="lootra-input"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <button type="submit" disabled={busy} className="lootra-btn-primary w-full">
          {busy ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
