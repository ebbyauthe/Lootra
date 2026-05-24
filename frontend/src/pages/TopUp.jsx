import React, { useState } from "react";
import { toast } from "sonner";
import { CreditCard, CheckCircle } from "lucide-react";
import { api, formatError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useCurrency, CURRENCIES } from "../context/CurrencyContext";

function FiatTab() {
  const { currency, rates } = useCurrency();
  const [amount, setAmount] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState(currency);
  const [busy, setBusy] = useState(false);

  const usdEquiv = amount
    ? (parseFloat(amount) / (rates[selectedCurrency] || 1)).toFixed(2)
    : null;

  const pay = async () => {
    if (!amount || parseFloat(amount) <= 0) { toast.error("Enter a valid amount"); return; }
    setBusy(true);
    try {
      const { data } = await api.post("/wallet/fiat-topup", {
        amount: parseFloat(amount),
        currency: selectedCurrency,
      });
      window.location.href = data.payment_link;
    } catch (e) {
      toast.error(formatError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500 block mb-2">Currency</label>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {CURRENCIES.map((c) => (
            <button
              key={c.code}
              onClick={() => setSelectedCurrency(c.code)}
              className={`flex flex-col items-center gap-1 py-3 border text-xs font-mono transition-colors ${
                selectedCurrency === c.code
                  ? "border-[#CCFF00] text-[#CCFF00] bg-[#CCFF00]/5"
                  : "border-[#2A2A2A] text-neutral-400 hover:border-neutral-500 hover:text-white"
              }`}
            >
              <span className="text-lg">{c.flag}</span>
              <span>{c.code}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500 block mb-2">
          Amount ({selectedCurrency})
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-neutral-400 text-sm">
            {CURRENCIES.find((c) => c.code === selectedCurrency)?.symbol}
          </span>
          <input
            type="number"
            min="1"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-transparent border border-[#2A2A2A] px-8 py-3 font-mono text-sm focus:outline-none focus:border-[#CCFF00] transition-colors"
          />
        </div>
        {usdEquiv && (
          <p className="text-xs text-neutral-500 font-mono mt-2">
            ≈ ${usdEquiv} USD will be added to your wallet
          </p>
        )}
      </div>

      <div className="lootra-card p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <CheckCircle className="w-4 h-4 text-[#CCFF00] shrink-0" />
          <span>Secured by Flutterwave — card, bank transfer &amp; mobile money accepted</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <CheckCircle className="w-4 h-4 text-[#CCFF00] shrink-0" />
          <span>Your payment is converted to USD and credited immediately after verification</span>
        </div>
      </div>

      <button
        onClick={pay}
        disabled={busy || !amount}
        className="lootra-btn-primary w-full"
        data-testid="fiat-pay-btn"
      >
        {busy ? "Creating payment…" : amount
          ? `Pay ${CURRENCIES.find(c => c.code === selectedCurrency)?.symbol}${amount} · Flutterwave`
          : "Continue to payment"}
      </button>
    </div>
  );
}

export default function TopUp() {
  const { user } = useAuth();
  const { formatPrice } = useCurrency();

  return (
    <div className="max-w-lg mx-auto space-y-8 animate-fade-in">
      <div>
        <div className="lootra-badge inline-block mb-3">WALLET</div>
        <h1 className="text-3xl font-medium tracking-tight">Top Up</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Current balance: <span className="font-mono text-[#CCFF00]">{formatPrice(user?.balance)}</span>
        </p>
      </div>

      <div className="flex items-center gap-2 text-xs text-neutral-500 font-mono border border-[#2A2A2A] px-4 py-3">
        <CreditCard className="w-4 h-4 text-[#CCFF00]" />
        Card / Bank Transfer via Flutterwave
      </div>

      <FiatTab />
    </div>
  );
}
