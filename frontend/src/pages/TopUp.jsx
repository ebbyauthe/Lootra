import React, { useState } from "react";
import { toast } from "sonner";
import { Wallet, CreditCard, Bitcoin, Copy, CheckCircle, AlertCircle } from "lucide-react";
import { api, formatError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useCurrency, CURRENCIES } from "../context/CurrencyContext";

const CRYPTO_OPTIONS = [
  { code: "btc",  label: "Bitcoin",  symbol: "BTC" },
  { code: "eth",  label: "Ethereum", symbol: "ETH" },
  { code: "usdt", label: "USDT",     symbol: "USDT (TRC20 / ERC20)" },
  { code: "usdc", label: "USDC",     symbol: "USDC" },
  { code: "ltc",  label: "Litecoin", symbol: "LTC" },
  { code: "sol",  label: "Solana",   symbol: "SOL" },
];

function FiatTab({ onRefresh }) {
  const { user } = useAuth();
  const { currency, rates, formatPrice } = useCurrency();

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
          ? `Pay ${CURRENCIES.find(c=>c.code===selectedCurrency)?.symbol}${amount} · Flutterwave`
          : "Continue to payment"}
      </button>
    </div>
  );
}

const STATUS_LABEL = {
  waiting:       { text: "Waiting for payment",     color: "text-[#FFB020]" },
  confirming:    { text: "Confirming on-chain…",    color: "text-blue-400" },
  confirmed:     { text: "Confirmed",               color: "text-[#CCFF00]" },
  sending:       { text: "Processing…",             color: "text-[#CCFF00]" },
  partially_paid:{ text: "Partially paid",          color: "text-[#FFB020]" },
  finished:      { text: "Credited to wallet ✓",   color: "text-[#CCFF00]" },
  failed:        { text: "Payment failed",          color: "text-[#FF453A]" },
  expired:       { text: "Payment expired",         color: "text-[#FF453A]" },
};

function useCountdown(expiresAt) {
  const [secs, setSecs] = useState(null);
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setSecs(Math.max(0, Math.floor((new Date(expiresAt) - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  if (secs === null) return null;
  const m = Math.floor(secs / 60), s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function CryptoTab() {
  const { refresh } = useAuth();
  const [amountUSD, setAmountUSD] = useState("");
  const [payCurrency, setPayCurrency] = useState("btc");
  const [busy, setBusy] = useState(false);
  const [payment, setPayment] = useState(null);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState("waiting");
  const [credited, setCredited] = useState(false);
  const countdown = useCountdown(payment?.expires_at);

  useEffect(() => {
    if (!payment?.payment_id || credited) return;
    const poll = async () => {
      try {
        const { data } = await api.get(`/wallet/crypto-status/${payment.payment_id}`);
        setStatus(data.status);
        if (data.credited) { setCredited(true); refresh(); toast.success("Wallet credited!"); }
      } catch {}
    };
    poll();
    const id = setInterval(poll, 30000);
    return () => clearInterval(id);
  }, [payment?.payment_id, credited, refresh]);

  const generate = async () => {
    if (!amountUSD || parseFloat(amountUSD) < 1) { toast.error("Minimum $1 USD"); return; }
    setBusy(true);
    try {
      const { data } = await api.post("/wallet/crypto-topup", {
        amount_usd: parseFloat(amountUSD),
        pay_currency: payCurrency,
      });
      setPayment(data);
      setStatus("waiting");
      setCredited(false);
    } catch (e) {
      toast.error(formatError(e));
    } finally {
      setBusy(false);
    }
  };

  const copy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Address copied");
  };

  if (payment) {
    const s = STATUS_LABEL[status] || STATUS_LABEL.waiting;
    return (
      <div className="space-y-5">
        <div className="lootra-card p-5 space-y-4">
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500">Send exactly</div>
            <div className="font-mono text-2xl text-[#CCFF00] mt-1">
              {payment.pay_amount} {payment.pay_currency?.toUpperCase()}
            </div>
            <div className="text-xs text-neutral-400 font-mono mt-1">≈ ${amountUSD} USD</div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500 mb-2">Payment address</div>
            <div className="flex items-center gap-2 bg-[#111] border border-[#2A2A2A] px-3 py-2">
              <span className="font-mono text-xs text-neutral-300 break-all flex-1">{payment.pay_address}</span>
              <button onClick={() => copy(payment.pay_address)} className="shrink-0 text-neutral-400 hover:text-[#CCFF00] transition-colors">
                {copied ? <CheckCircle className="w-4 h-4 text-[#CCFF00]" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-mono ${s.color}`}>{s.text}</span>
              {!credited && status !== "failed" && status !== "expired" && (
                <span className="inline-block w-2 h-2 rounded-full bg-current animate-pulse" style={{color: "inherit"}} />
              )}
            </div>
            {countdown !== null && !credited && status !== "expired" && (
              <span className="text-[10px] font-mono text-neutral-500">Expires in {countdown}</span>
            )}
          </div>

          {!credited && (
            <div className="flex items-start gap-2 text-xs text-neutral-400">
              <AlertCircle className="w-4 h-4 text-[#FFB020] shrink-0 mt-0.5" />
              <span>Send the exact amount shown. Status updates automatically every 30 seconds. Your wallet will be credited once confirmed on-chain (usually 10–30 min).</span>
            </div>
          )}
        </div>

        {!credited && (
          <button onClick={() => setPayment(null)} className="lootra-btn-secondary w-full">
            Generate a new payment
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500 block mb-2">
          Amount (USD)
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-neutral-400 text-sm">$</span>
          <input
            type="number"
            min="1"
            step="1"
            value={amountUSD}
            onChange={(e) => setAmountUSD(e.target.value)}
            placeholder="0.00"
            className="w-full bg-transparent border border-[#2A2A2A] pl-8 pr-3 py-3 font-mono text-sm focus:outline-none focus:border-[#CCFF00] transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500 block mb-2">
          Pay with
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {CRYPTO_OPTIONS.map((c) => (
            <button
              key={c.code}
              onClick={() => setPayCurrency(c.code)}
              className={`flex flex-col items-start gap-0.5 p-3 border text-xs font-mono transition-colors ${
                payCurrency === c.code
                  ? "border-[#CCFF00] text-[#CCFF00] bg-[#CCFF00]/5"
                  : "border-[#2A2A2A] text-neutral-400 hover:border-neutral-500 hover:text-white"
              }`}
            >
              <span className="font-medium">{c.label}</span>
              <span className="text-[10px] text-neutral-500">{c.code.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="lootra-card p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <CheckCircle className="w-4 h-4 text-[#CCFF00] shrink-0" />
          <span>Powered by NOWPayments — self-custodial, non-KYC</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <CheckCircle className="w-4 h-4 text-[#CCFF00] shrink-0" />
          <span>Wallet credited in USD equivalent once confirmed on-chain</span>
        </div>
      </div>

      <button
        onClick={generate}
        disabled={busy || !amountUSD}
        className="lootra-btn-primary w-full"
        data-testid="crypto-generate-btn"
      >
        {busy ? "Generating address…" : "Get payment address"}
      </button>
    </div>
  );
}

export default function TopUp() {
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const [tab, setTab] = useState("fiat");

  return (
    <div className="max-w-lg mx-auto space-y-8 animate-fade-in">
      <div>
        <div className="lootra-badge inline-block mb-3">WALLET</div>
        <h1 className="text-3xl font-medium tracking-tight">Top Up</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Current balance: <span className="font-mono text-[#CCFF00]">{formatPrice(user?.balance)}</span>
        </p>
      </div>

      <div className="border-b border-[#2A2A2A] flex gap-1">
        <button
          onClick={() => setTab("fiat")}
          className={`px-5 py-3 text-sm tracking-tight transition-colors border-b-2 flex items-center gap-2 ${
            tab === "fiat" ? "border-[#CCFF00] text-white" : "border-transparent text-neutral-400 hover:text-white"
          }`}
        >
          <CreditCard className="w-4 h-4" /> Card / Bank
        </button>
        <button
          onClick={() => setTab("crypto")}
          className={`px-5 py-3 text-sm tracking-tight transition-colors border-b-2 flex items-center gap-2 ${
            tab === "crypto" ? "border-[#CCFF00] text-white" : "border-transparent text-neutral-400 hover:text-white"
          }`}
        >
          <Bitcoin className="w-4 h-4" /> Crypto
        </button>
      </div>

      <div>
        {tab === "fiat" && <FiatTab />}
        {tab === "crypto" && <CryptoTab />}
      </div>
    </div>
  );
}
