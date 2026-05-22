import React, { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { Turnstile } from "@marsidev/react-turnstile";
import { useAuth } from "../context/AuthContext";
import { api, formatError } from "../lib/api";

const SITE_KEY = "0x4AAAAAADT-fceKK6DFxAM7";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const [resending, setResending] = useState(false);
  const [token, setToken] = useState("");
  const turnstileRef = useRef(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!token) {
      toast.error("Please wait for the security check to complete.");
      return;
    }
    setBusy(true);
    setUnverified(false);
    const r = await login(form.email, form.password, token);
    setBusy(false);
    if (r.ok) { toast.success("Welcome back"); nav("/dashboard"); }
    else if (r.error === "EMAIL_NOT_VERIFIED") {
      setUnverified(true);
      turnstileRef.current?.reset();
      setToken("");
    } else {
      toast.error(r.error);
      turnstileRef.current?.reset();
      setToken("");
    }
  };

  const resendVerification = async () => {
    setResending(true);
    try {
      await api.post("/auth/resend-verification", { email: form.email });
      toast.success("Verification email sent — check your inbox");
    } catch (err) {
      toast.error(formatError(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 animate-fade-in">
      <div className="lootra-badge inline-block mb-3">ACCESS</div>
      <h1 className="text-3xl font-medium tracking-tight mb-2">Sign in</h1>
      <p className="text-sm text-neutral-400 mb-8">Access your escrow dashboard and active trades.</p>
      <form onSubmit={submit} className="space-y-4" data-testid="login-form">
        <div>
          <label className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500 block mb-2">Email</label>
          <input type="email" className="lootra-input" required value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="login-email" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500 block mb-2">Password</label>
          <input type="password" className="lootra-input" required value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="login-password" />
        </div>
        <Turnstile
          ref={turnstileRef}
          siteKey={SITE_KEY}
          onSuccess={setToken}
          onExpire={() => setToken("")}
          options={{ theme: "dark" }}
        />
        <button type="submit" disabled={busy || !token} className="lootra-btn-primary w-full" data-testid="login-submit">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {unverified && (
        <div className="mt-4 p-4 border border-[#FFB020]/30 bg-[#FFB020]/5 flex items-start gap-3">
          <Mail className="w-4 h-4 text-[#FFB020] shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="text-[#FFB020] font-medium">Email not verified</div>
            <div className="text-neutral-400 text-xs mt-0.5">Check your inbox for the verification link.</div>
            <button onClick={resendVerification} disabled={resending} className="text-[#CCFF00] hover:underline text-xs mt-1.5">
              {resending ? "Sending…" : "Resend verification email"}
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-sm mt-6">
        <span className="text-neutral-500">New to Lootra? <Link to="/register" className="text-[#CCFF00] hover:underline">Create an account</Link></span>
        <Link to="/forgot-password" className="text-neutral-500 hover:text-white transition-colors">Forgot password?</Link>
      </div>
    </div>
  );
}
