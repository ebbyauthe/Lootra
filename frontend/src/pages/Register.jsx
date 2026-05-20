import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ email: "", username: "", password: "" });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const r = await register(form);
    setBusy(false);
    if (r.ok) { toast.success("Account created — $500 demo balance added"); nav("/dashboard"); }
    else toast.error(r.error);
  };

  return (
    <div className="max-w-md mx-auto py-12 animate-fade-in">
      <div className="lootra-badge inline-block mb-3">JOIN LOOTRA</div>
      <h1 className="text-3xl font-medium tracking-tight mb-2">Create account</h1>
      <p className="text-sm text-neutral-400 mb-8">Get $500 demo balance to test buying instantly.</p>
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
          <input type="password" className="lootra-input" required minLength={6} value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="register-password" />
        </div>
        <button type="submit" disabled={busy} className="lootra-btn-primary w-full" data-testid="register-submit">
          {busy ? "Creating…" : "Create account"}
        </button>
      </form>
      <div className="text-sm text-neutral-500 mt-6">
        Have an account? <Link to="/login" className="text-[#CCFF00] hover:underline">Sign in</Link>
      </div>
    </div>
  );
}
