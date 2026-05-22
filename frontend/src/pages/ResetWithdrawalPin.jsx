import React, { useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { api, formatError } from "../lib/api";

function PinInput({ value = "", onChange, autoFocus }) {
  const refs = useRef([]);
  const arr = (value + "      ").slice(0, 6).split("");

  const handleInput = (i, e) => {
    const ch = e.target.value.replace(/\D/g, "").slice(-1);
    if (!ch) return;
    const next = [...arr];
    next[i] = ch;
    onChange(next.join("").replace(/ /g, "").slice(0, 6));
    if (i < 5) setTimeout(() => refs.current[i + 1]?.focus(), 0);
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (arr[i].trim()) {
        const next = [...arr];
        next[i] = " ";
        onChange(next.join("").replace(/ /g, ""));
      } else if (i > 0) {
        const next = [...arr];
        next[i - 1] = " ";
        onChange(next.join("").replace(/ /g, ""));
        setTimeout(() => refs.current[i - 1]?.focus(), 0);
      }
    }
  };

  return (
    <div className="flex gap-2 justify-center">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          type="password"
          inputMode="numeric"
          maxLength={1}
          value={arr[i].trim()}
          autoFocus={autoFocus && i === 0}
          onChange={(e) => handleInput(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className="w-11 h-14 text-center bg-[#1a1a1a] border border-[#2A2A2A] rounded-xl font-mono text-xl focus:outline-none focus:border-[#CCFF00] text-white caret-transparent"
        />
      ))}
    </div>
  );
}

export default function ResetWithdrawalPin() {
  const [searchParams] = useSearchParams();
  const nav = useNavigate();
  const token = searchParams.get("token") || "";

  const [step, setStep] = useState("new");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!token) {
    return (
      <div className="max-w-sm mx-auto py-24 text-center space-y-4">
        <div className="text-[#FF453A] font-mono text-sm">Invalid or missing reset link.</div>
      </div>
    );
  }

  const handleNext = () => {
    if (newPin.length !== 6) { setError("Enter a 6-digit PIN"); return; }
    setError("");
    setStep("confirm");
  };

  const handleSave = async () => {
    if (confirmPin !== newPin) { setError("PINs do not match"); return; }
    setSaving(true);
    setError("");
    try {
      await api.post("/auth/withdrawal-pin/reset", { token, pin: newPin });
      toast.success("Withdrawal PIN reset. Please log in.");
      nav("/login");
    } catch (e) {
      setError(formatError(e) || "Reset failed. The link may have expired.");
    }
    setSaving(false);
  };

  return (
    <div className="max-w-sm mx-auto py-16 animate-fade-in">
      <div className="lootra-badge inline-block mb-4">SECURITY</div>
      <h1 className="text-2xl font-medium tracking-tight mb-1">Reset withdrawal PIN</h1>
      <p className="text-sm text-neutral-400 mb-8">
        {step === "new" ? "Choose a new 6-digit PIN for withdrawals." : "Enter the PIN again to confirm."}
      </p>

      <div className="lootra-card p-6 space-y-6">
        <div className="flex justify-center">
          <div className="w-12 h-12 bg-[#CCFF00]/10 rounded-xl flex items-center justify-center">
            <Lock className="w-6 h-6 text-[#CCFF00]" />
          </div>
        </div>

        <PinInput
          value={step === "new" ? newPin : confirmPin}
          onChange={(v) => {
            setError("");
            if (step === "new") setNewPin(v);
            else setConfirmPin(v);
          }}
          autoFocus
        />

        {error && <p className="text-center text-sm text-[#FF453A]">{error}</p>}

        {step === "new" ? (
          <button
            type="button"
            onClick={handleNext}
            disabled={newPin.length !== 6}
            className="w-full lootra-btn-primary py-3.5 disabled:opacity-40"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || confirmPin.length !== 6}
            className="w-full lootra-btn-primary py-3.5 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save new PIN"}
          </button>
        )}
      </div>
    </div>
  );
}
