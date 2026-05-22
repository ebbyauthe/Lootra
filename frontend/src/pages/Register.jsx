import React, { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { Turnstile } from "@marsidev/react-turnstile";
import { api, formatError } from "../lib/api";

const SITE_KEY = "0x4AAAAAADT-fceKK6DFxAM7";

export default function Register() {
  const [form, setForm] = useState({ email: "", username: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [token, setToken] = useState("");
  const turnstileRef = useRef(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!token) {
      toast.error("Please wait for the security check to complete.");
      return;
    }
    setBusy(true);
    try {
      await api.post("/auth/register", { ...form, cf_token: token });
      setDone(true);
    } catch (err) {
      toast.error(formatError(err));
      turnstileRef.current?.reset();
      setToken("");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="max-w-md mx-auto py-12 animate-fade-in">
        <div className="lootra-card p-8 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-[#CCFF00]/10 border-2 border-[#CCFF00] flex items-center justify-center">
            <Mail className="w-7 h-7 text-[#CCFF00]" />
          </div>
          <div>
            <div className="text-lg font-medium text-white">Check your email</div>
            <div className="text-sm text-neutral-400 mt-2">
              We sent a verification link to <span className="text-white font-mono">{form.email}</span>. Click it to activate your account.
            </div>
          </div>
          <div className="text-xs text-neutral-600 mt-2">Didn't get it? Check your spam folder.</div>
          <Link to="/login" className="text-sm text-neutral-500 hover:text-white transition-colors mt-1">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-12 animate-fade-in">
      <div className="lootra-badge inline-block mb-3">JOIN LOOTRA</div>
      <h1 className="text-3xl font-medium tracking-tight mb-2">Create account</h1>
      <p className="text-sm text-neutral-400 mb-8">Start buying and selling in-game items securely.</p>
      <form onSubmit={submit} className="space-y-4" data-testid="register-form">
        <div>
          <label className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500 block mb-2">Username</label>
          <input className="lootra-input" required minLength={3} value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })} data-testid="register-username" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500 block mb-2">Email</label>
          <input type="email" className="lootra-input" required value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="register-email" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500 block mb-2">Password</label>
          <input type="password" className="lootra-input" required minLength={8} value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="register-password" />
        </div>
        <Turnstile
          ref={turnstileRef}
          siteKey={SITE_KEY}
          onSuccess={setToken}
          onExpire={() => setToken("")}
          options={{ theme: "dark" }}
        />
        <button type="submit" disabled={busy || !token} className="lootra-btn-primary w-full" data-testid="register-submit">
          {busy ? "Creating…" : "Create account"}
        </button>
      </form>
      <div className="text-sm text-neutral-500 mt-6">
        Have an account? <Link to="/login" className="text-[#CCFF00] hover:underline">Sign in</Link>
      </div>
    </div>
  );
}
