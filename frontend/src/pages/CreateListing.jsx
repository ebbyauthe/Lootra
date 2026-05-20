import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Lock, ImageIcon, X, Plus } from "lucide-react";
import { api, formatError } from "../lib/api";

const STEPS = ["Category", "Account details", "Screenshots", "Credentials", "Review"];

export default function CreateListing() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [games, setGames] = useState([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    category: "gaming",
    title: "",
    description: "",
    price: "",
    game: "Valorant",
    platform: "PC",
    region: "NA",
    rank: "",
    level: "",
    account_age_years: "",
    skins_count: "",
    screenshots: [],
    credentials_login: "",
    credentials_password: "",
    recovery_email: "",
    backup_codes: "",
  });
  const [newShot, setNewShot] = useState("");

  useEffect(() => { api.get("/catalog/games").then(({ data }) => setGames(data)).catch(() => {}); }, []);

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setBusy(true);
    const payload = {
      ...form,
      price: parseFloat(form.price),
      level: parseInt(form.level) || 0,
      account_age_years: parseFloat(form.account_age_years) || 0,
      skins_count: parseInt(form.skins_count) || 0,
    };
    try {
      await api.post("/listings", payload);
      toast.success("Listing submitted — admin review pending");
      nav("/dashboard");
    } catch (e) { toast.error(formatError(e)); }
    finally { setBusy(false); }
  };

  const addShot = () => {
    if (!newShot.trim()) return;
    upd("screenshots", [...form.screenshots, newShot.trim()]);
    setNewShot("");
  };

  const removeShot = (i) => upd("screenshots", form.screenshots.filter((_, idx) => idx !== i));

  const canNext = () => {
    if (step === 0) return !!form.category;
    if (step === 1) return form.title.length >= 5 && form.description.length >= 10 && parseFloat(form.price) > 0;
    if (step === 3) return form.credentials_login && form.credentials_password;
    return true;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
      <div>
        <div className="lootra-badge inline-block mb-3">NEW LISTING</div>
        <h1 className="text-3xl md:text-4xl font-medium tracking-tight">List an account</h1>
        <p className="text-sm text-neutral-400 mt-1">Your credentials encrypt instantly. Admins verify before going live.</p>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar" data-testid="wizard-steps">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2 shrink-0">
            <div className={`w-7 h-7 flex items-center justify-center font-mono text-xs ${
              i <= step ? "bg-[#CCFF00] text-black" : "border border-[#2A2A2A] text-neutral-500"
            }`}>{i + 1}</div>
            <div className={`text-xs uppercase tracking-[0.2em] font-mono ${i === step ? "text-[#CCFF00]" : "text-neutral-500"}`}>{s}</div>
            {i < STEPS.length - 1 && <div className="w-6 h-px bg-[#2A2A2A]" />}
          </div>
        ))}
      </div>

      <div className="lootra-card p-6 space-y-5">
        {step === 0 && (
          <div className="space-y-4" data-testid="step-category">
            <Label>Category</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { id: "gaming", label: "Gaming", on: true },
                { id: "social", label: "Social (soon)", on: false },
                { id: "streaming", label: "Streaming (soon)", on: false },
                { id: "subscription", label: "Subscriptions (soon)", on: false },
              ].map((c) => (
                <button key={c.id} disabled={!c.on} onClick={() => upd("category", c.id)}
                  className={`p-4 border text-left transition-colors ${
                    form.category === c.id ? "border-[#CCFF00] bg-[rgba(204,255,0,0.05)]" : "border-[#2A2A2A]"
                  } ${!c.on ? "opacity-40 cursor-not-allowed" : "hover:border-[#555]"}`}
                  data-testid={`cat-${c.id}`}>
                  <div className="font-medium text-sm">{c.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4" data-testid="step-details">
            <Field label="Title"><input className="lootra-input" value={form.title} onChange={(e) => upd("title", e.target.value)} data-testid="field-title" /></Field>
            <Field label="Description"><textarea className="lootra-input min-h-[120px]" value={form.description} onChange={(e) => upd("description", e.target.value)} data-testid="field-description" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Price (USD)"><input type="number" min="0" step="0.01" className="lootra-input" value={form.price} onChange={(e) => upd("price", e.target.value)} data-testid="field-price" /></Field>
              <Field label="Game">
                <select className="lootra-input" value={form.game} onChange={(e) => upd("game", e.target.value)} data-testid="field-game">
                  {games.map((g) => <option key={g.id}>{g.name}</option>)}
                </select>
              </Field>
              <Field label="Platform">
                <select className="lootra-input" value={form.platform} onChange={(e) => upd("platform", e.target.value)} data-testid="field-platform">
                  <option>PC</option><option>PS</option><option>Xbox</option><option>Mobile</option><option>Switch</option>
                </select>
              </Field>
              <Field label="Region">
                <select className="lootra-input" value={form.region} onChange={(e) => upd("region", e.target.value)} data-testid="field-region">
                  <option>NA</option><option>EU</option><option>APAC</option><option>LATAM</option><option>Global</option>
                </select>
              </Field>
              <Field label="Rank"><input className="lootra-input" value={form.rank} onChange={(e) => upd("rank", e.target.value)} /></Field>
              <Field label="Level"><input type="number" className="lootra-input" value={form.level} onChange={(e) => upd("level", e.target.value)} /></Field>
              <Field label="Account age (years)"><input type="number" step="0.1" className="lootra-input" value={form.account_age_years} onChange={(e) => upd("account_age_years", e.target.value)} /></Field>
              <Field label="Skins / items count"><input type="number" className="lootra-input" value={form.skins_count} onChange={(e) => upd("skins_count", e.target.value)} /></Field>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4" data-testid="step-screenshots">
            <Label>Screenshots (paste image URLs)</Label>
            <div className="flex gap-2">
              <input className="lootra-input" placeholder="https://..." value={newShot} onChange={(e) => setNewShot(e.target.value)} data-testid="field-screenshot-url" />
              <button onClick={addShot} className="lootra-btn-secondary inline-flex items-center gap-1" data-testid="add-screenshot-btn"><Plus className="w-4 h-4" /></button>
            </div>
            {form.screenshots.length === 0 ? (
              <div className="border border-dashed border-[#2A2A2A] p-8 text-center text-neutral-500 font-mono text-xs flex items-center justify-center gap-2"><ImageIcon className="w-4 h-4" /> No screenshots yet</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {form.screenshots.map((s, i) => (
                  <div key={i} className="relative aspect-[16/10] border border-[#2A2A2A]">
                    <img src={s} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => removeShot(i)} className="absolute top-1 right-1 w-6 h-6 bg-black/80 flex items-center justify-center hover:bg-[#FF453A]" data-testid={`remove-shot-${i}`}>
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4" data-testid="step-credentials">
            <div className="flex items-start gap-2 p-4 border border-[rgba(204,255,0,0.3)] bg-[rgba(204,255,0,0.05)]">
              <Lock className="w-4 h-4 text-[#CCFF00] mt-0.5 shrink-0" />
              <div className="text-xs text-neutral-300">
                These credentials are encrypted with AES-128 the moment you submit. Only released to the buyer after escrow clears.
              </div>
            </div>
            <Field label="Account login / username"><input className="lootra-input" value={form.credentials_login} onChange={(e) => upd("credentials_login", e.target.value)} data-testid="field-cred-login" /></Field>
            <Field label="Account password"><input className="lootra-input" value={form.credentials_password} onChange={(e) => upd("credentials_password", e.target.value)} data-testid="field-cred-password" /></Field>
            <Field label="Recovery email (optional)"><input className="lootra-input" value={form.recovery_email} onChange={(e) => upd("recovery_email", e.target.value)} /></Field>
            <Field label="Backup codes (optional)"><textarea className="lootra-input min-h-[80px]" value={form.backup_codes} onChange={(e) => upd("backup_codes", e.target.value)} /></Field>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3 font-mono text-xs" data-testid="step-review">
            <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 mb-2">Review</div>
            {Object.entries({
              Title: form.title, Game: form.game, Platform: form.platform, Region: form.region,
              Price: `$${form.price}`, Rank: form.rank || "—", Level: form.level || "—",
              Screenshots: `${form.screenshots.length} attached`,
              Credentials: "🔒 encrypted (hidden)",
            }).map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-[#2A2A2A] py-2">
                <span className="text-neutral-500">{k}</span>
                <span className="text-neutral-200">{v}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-between pt-4 border-t border-[#2A2A2A]">
          <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="lootra-btn-secondary" data-testid="wizard-back">Back</button>
          {step < STEPS.length - 1 ? (
            <button onClick={() => canNext() && setStep(step + 1)} disabled={!canNext()} className="lootra-btn-primary" data-testid="wizard-next">Continue</button>
          ) : (
            <button onClick={submit} disabled={busy} className="lootra-btn-primary" data-testid="wizard-submit">{busy ? "Submitting…" : "Submit listing"}</button>
          )}
        </div>
      </div>
    </div>
  );
}

const Label = ({ children }) => <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500">{children}</div>;
const Field = ({ label, children }) => (
  <div className="space-y-2"><Label>{label}</Label>{children}</div>
);
