import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const r = await login(form.email, form.password);
    setBusy(false);
    if (r.ok) { toast.success("Welcome back"); nav("/dashboard"); }
    else toast.error(r.error);
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
        <button type="submit" disabled={busy} className="lootra-btn-primary w-full" data-testid="login-submit">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <div className="text-sm text-neutral-500 mt-6">
        New to Lootra? <Link to="/register" className="text-[#CCFF00] hover:underline">Create an account</Link>
      </div>
    </div>
  );
}
