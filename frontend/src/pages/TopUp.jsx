import React, { useState, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useBlocker } from "react-router-dom";
import { toast } from "sonner";
import { CreditCard, Bitcoin, Copy, CheckCircle, AlertCircle, RefreshCw, X } from "lucide-react";
import { api, formatError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useCurrency, CURRENCIES } from "../context/CurrencyContext";

const CRYPTO_OPTIONS = [
  { code: "btc",  label: "Bitcoin",   ticker: "BTC",  network: "Bitcoin Network", dot: "#F7931A", uriScheme: "bitcoin"  },
  { code: "eth",  label: "Ethereum",  ticker: "ETH",  network: "ERC20",           dot: "#627EEA", uriScheme: "ethereum" },
  { code: "usdt", label: "Tether",    ticker: "USDT", network: "TRC20",           dot: "#26A17B", uriScheme: null       },
  { code: "usdc", label: "USD Coin",  ticker: "USDC", network: "ERC20",           dot: "#2775CA", uriScheme: null       },
  { code: "ltc",  label: "Litecoin",  ticker: "LTC",  network: "Litecoin",        dot: "#345D9D", uriScheme: "litecoin" },
  { code: "sol",  label: "Solana",    ticker: "SOL",  network: "Solana",          dot: "#9945FF", uriScheme: "solana"   },
];

function cryptoURI(coin, address, amount) {
  if (!address) return "";
  if (!coin?.uriScheme) return address;
  const base = `${coin.uriScheme}:${address}`;
  return amount ? `${base}?amount=${amount}` : base;
}

const STATUS_META = {
  waiting:        { text: "Waiting for payment",   step: 1, color: "text-[#FFB020]", dot: "#FFB020" },
  confirming:     { text: "Confirming on-chain",   step: 2, color: "text-blue-400",  dot: "#60A5FA" },
  confirmed:      { text: "Confirmed",             step: 2, color: "text-blue-400",  dot: "#60A5FA" },
  sending:        { text: "Processing",            step: 2, color: "text-blue-400",  dot: "#60A5FA" },
  partially_paid: { text: "Partially paid",        step: 1, color: "text-[#FFB020]", dot: "#FFB020" },
  finished:       { text: "Credited to wallet",    step: 3, color: "text-[#CCFF00]", dot: "#CCFF00" },
  failed:         { text: "Payment failed",        step: 0, color: "text-[#FF453A]", dot: "#FF453A" },
  expired:        { text: "Payment expired",       step: 0, color: "text-[#FF453A]", dot: "#FF453A" },
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

function StepBar({ step }) {
  const steps = ["Send", "Confirming", "Credited"];
  return (
    <div className="flex items-start gap-0">
      {steps.map((label, i) => {
        const idx = i + 1;
        const done = step > idx;
        const active = step === idx;
        return (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono font-bold border-2 transition-all ${
                done    ? "bg-[#CCFF00] border-[#CCFF00] text-black" :
                active  ? "border-[#CCFF00] text-[#CCFF00] bg-[#CCFF00]/10" :
                          "border-[#333] text-neutral-600"
              }`}>
                {done ? <CheckCircle className="w-4 h-4" /> : idx}
              </div>
              <span className={`text-[9px] font-mono uppercase tracking-wider whitespace-nowrap ${
                active ? "text-[#CCFF00]" : done ? "text-neutral-400" : "text-neutral-600"
              }`}>{label}</span>
            </div>
            {i < 2 && (
              <div className={`flex-1 h-px mt-4 mx-1 transition-colors ${done ? "bg-[#CCFF00]" : "bg-[#2A2A2A]"}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

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

function CancelDialog({ onConfirm, onDismiss }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="lootra-card max-w-sm w-full p-6 space-y-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[#FFB020] shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-medium text-white">Cancel this payment?</div>
            <div className="text-xs text-neutral-400 mt-1">
              If you already sent funds to this address, they will still be credited automatically once confirmed on-chain. You can safely cancel if you haven't sent anything yet.
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onDismiss} className="lootra-btn-secondary flex-1 text-sm">Keep waiting</button>
          <button onClick={onConfirm} className="flex-1 py-2 px-4 border border-[#FF453A] text-[#FF453A] hover:bg-[#FF453A]/10 transition-colors font-mono text-xs">
            Cancel payment
          </button>
        </div>
      </div>
    </div>
  );
}

function CryptoTab() {
  const { refresh } = useAuth();
  const [amountUSD, setAmountUSD] = useState("");
  const [payCurrency, setPayCurrency] = useState("btc");
  const [busy, setBusy] = useState(false);
  const [payment, setPayment] = useState(null);
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [copiedAmt, setCopiedAmt] = useState(false);
  const [status, setStatus] = useState("waiting");
  const [credited, setCredited] = useState(false);
  const [nextPoll, setNextPoll] = useState(30);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const countdown = useCountdown(payment?.expires_at);

  const isPendingPayment = !!payment && !credited && status !== "failed" && status !== "expired";

  // Block in-app navigation while payment is pending
  const blocker = useBlocker(useCallback(() => isPendingPayment, [isPendingPayment]));
  useEffect(() => {
    if (blocker.state === "blocked") setShowCancelDialog(true);
  }, [blocker.state]);

  // Block browser tab close / refresh while payment is pending
  useEffect(() => {
    if (!isPendingPayment) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isPendingPayment]);

  useEffect(() => {
    if (!payment?.payment_id || credited) return;
    let pollSecs = 30;

    const poll = async () => {
      try {
        const { data } = await api.get(`/wallet/crypto-status/${payment.payment_id}`);
        setStatus(data.status);
        if (data.credited) {
          setCredited(true);
          refresh();
          toast.success("Wallet credited!");
        }
      } catch {}
      pollSecs = 30;
      setNextPoll(30);
    };

    poll();
    const pollId = setInterval(poll, 30000);
    const countId = setInterval(() => {
      pollSecs = Math.max(0, pollSecs - 1);
      setNextPoll(pollSecs);
    }, 1000);

    return () => { clearInterval(pollId); clearInterval(countId); };
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
      setNextPoll(30);
    } catch (e) {
      toast.error(formatError(e));
    } finally {
      setBusy(false);
    }
  };

  const copy = (text, which) => {
    navigator.clipboard.writeText(text);
    if (which === "addr") { setCopiedAddr(true); setTimeout(() => setCopiedAddr(false), 2000); }
    if (which === "amt")  { setCopiedAmt(true);  setTimeout(() => setCopiedAmt(false),  2000); }
    toast.success("Copied!");
  };

  const cancelPayment = () => {
    setPayment(null);
    setShowCancelDialog(false);
    if (blocker.state === "blocked") blocker.proceed?.();
  };

  const dismissCancel = () => {
    setShowCancelDialog(false);
    if (blocker.state === "blocked") blocker.reset?.();
  };

  const coin = CRYPTO_OPTIONS.find((c) => c.code === payCurrency);
  const payCoin = payment ? CRYPTO_OPTIONS.find((c) => c.code === payment.pay_currency) || coin : null;
  const statusMeta = STATUS_META[status] || STATUS_META.waiting;
  const step = credited ? 3 : statusMeta.step;
  const isError = !credited && (status === "failed" || status === "expired");

  if (payment) {
    return (
      <>
      {showCancelDialog && <CancelDialog onConfirm={cancelPayment} onDismiss={dismissCancel} />}
      <div className="space-y-4">
        <StepBar step={step} />

        {credited ? (
          <div className="lootra-card p-8 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-[#CCFF00]/10 border-2 border-[#CCFF00] flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-[#CCFF00]" />
            </div>
            <div>
              <div className="text-xl font-medium text-white">Payment received!</div>
              <div className="text-sm text-neutral-400 mt-1">${amountUSD} USD has been added to your wallet.</div>
            </div>
          </div>
        ) : isError ? (
          <div className="lootra-card p-8 flex flex-col items-center gap-4 text-center">
            <AlertCircle className="w-12 h-12 text-[#FF453A]" />
            <div>
              <div className={`text-sm font-mono font-medium ${statusMeta.color}`}>{statusMeta.text}</div>
              <div className="text-xs text-neutral-500 mt-1">This payment address is no longer valid.</div>
            </div>
            <button onClick={() => setPayment(null)} className="lootra-btn-secondary inline-flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Try again
            </button>
          </div>
        ) : (
          <div className="lootra-card overflow-hidden">
            {/* QR + coin header */}
            <div className="p-5 flex flex-col items-center gap-4 border-b border-[#2A2A2A]">
              {payment.pay_address ? (
                <div className="p-3 bg-white rounded-xl shadow-lg">
                  <QRCodeSVG
                    value={cryptoURI(payCoin, payment.pay_address, payment.pay_amount)}
                    size={160}
                    bgColor="#ffffff"
                    fgColor="#000000"
                    level="M"
                  />
                </div>
              ) : (
                <div className="w-[184px] h-[184px] border border-[#2A2A2A] flex items-center justify-center text-xs font-mono text-neutral-500 text-center px-4">
                  QR unavailable — use address below
                </div>
              )}
              <div className="flex items-center gap-2 px-3 py-1.5 border border-[#2A2A2A] rounded-full">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: payCoin?.dot }} />
                <span className="text-xs font-mono text-neutral-300">
                  {payment.pay_currency?.toUpperCase()} · {payCoin?.network}
                </span>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Amount to send */}
              <div className="text-center">
                <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500 mb-2">Send exactly</div>
                <button
                  onClick={() => copy(String(payment.pay_amount), "amt")}
                  className="group inline-flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <span className="font-mono text-3xl font-bold text-[#CCFF00]">{payment.pay_amount}</span>
                  <span className="font-mono text-lg text-neutral-400">{payment.pay_currency?.toUpperCase()}</span>
                  <span className="text-neutral-600 group-hover:text-neutral-300 transition-colors ml-1">
                    {copiedAmt ? <CheckCircle className="w-4 h-4 text-[#CCFF00]" /> : <Copy className="w-4 h-4" />}
                  </span>
                </button>
                <div className="text-xs text-neutral-500 font-mono mt-1">≈ ${amountUSD} USD</div>
              </div>

              {/* Address */}
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500 mb-2">Wallet address</div>
                <button
                  onClick={() => copy(payment.pay_address, "addr")}
                  className="w-full flex items-center gap-3 bg-[#0A0A0A] border border-[#2A2A2A] hover:border-neutral-500 transition-colors px-3 py-3 text-left group"
                >
                  <span className="font-mono text-xs text-neutral-300 break-all flex-1 leading-relaxed">
                    {payment.pay_address}
                  </span>
                  <span className="shrink-0 text-neutral-500 group-hover:text-[#CCFF00] transition-colors">
                    {copiedAddr ? <CheckCircle className="w-4 h-4 text-[#CCFF00]" /> : <Copy className="w-4 h-4" />}
                  </span>
                </button>
              </div>

              {/* Status + timer row */}
              <div className="flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: statusMeta.dot }} />
                  <span className={statusMeta.color}>{statusMeta.text}</span>
                </div>
                <div className="text-right space-y-0.5">
                  {countdown && <div className="text-neutral-500">Expires {countdown}</div>}
                  <div className="text-neutral-600 text-[10px]">Checking in {nextPoll}s</div>
                </div>
              </div>

              {/* Network warning */}
              <div className="flex items-start gap-2 p-3 bg-[#FFB020]/5 border border-[#FFB020]/20 rounded text-xs text-neutral-400">
                <AlertCircle className="w-4 h-4 text-[#FFB020] shrink-0 mt-0.5" />
                <span>
                  Send <strong className="text-white">only {payment.pay_currency?.toUpperCase()}</strong> on the{" "}
                  <strong className="text-white">{payCoin?.network}</strong> network.
                  {" "}Sending on the wrong network will result in permanent loss of funds.
                </span>
              </div>
            </div>
          </div>
        )}

        {!credited && !isError && (
          <button
            onClick={() => setShowCancelDialog(true)}
            className="w-full py-2.5 border border-[#2A2A2A] text-neutral-500 hover:border-[#FF453A] hover:text-[#FF453A] transition-colors font-mono text-xs flex items-center justify-center gap-2"
          >
            <X className="w-3.5 h-3.5" /> Cancel payment
          </button>
        )}
      </div>
      </>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="text-[10px] uppercase tracking-[0.2em] font-mono text-neutral-500 block mb-2">
          Amount (USD)
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-neutral-400 text-xl">$</span>
          <input
            type="number"
            min="1"
            step="1"
            value={amountUSD}
            onChange={(e) => setAmountUSD(e.target.value)}
            placeholder="0"
            className="w-full bg-transparent border border-[#2A2A2A] pl-10 pr-3 py-4 font-mono text-2xl focus:outline-none focus:border-[#CCFF00] transition-colors"
          />
        </div>
        <p className="text-[11px] text-neutral-600 font-mono mt-1.5">Minimum $1 · Credited as USD equivalent</p>
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
              className={`flex items-center gap-3 p-3 border text-left transition-colors ${
                payCurrency === c.code
                  ? "border-[#CCFF00] bg-[#CCFF00]/5"
                  : "border-[#2A2A2A] hover:border-neutral-600"
              }`}
            >
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.dot }} />
              <div className="min-w-0">
                <div className={`text-xs font-mono font-semibold truncate ${payCurrency === c.code ? "text-[#CCFF00]" : "text-white"}`}>
                  {c.ticker}
                </div>
                <div className="text-[10px] font-mono text-neutral-500 truncate">{c.network}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {coin && (
        <div className="flex items-center gap-2.5 px-3 py-2.5 border border-[#2A2A2A] bg-[#0A0A0A]">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: coin.dot }} />
          <span className="text-xs font-mono text-neutral-400">
            Paying with <span className="text-white">{coin.label} ({coin.ticker})</span> on the{" "}
            <span className="text-white">{coin.network}</span> network
          </span>
        </div>
      )}

      <button
        onClick={generate}
        disabled={busy || !amountUSD}
        className="lootra-btn-primary w-full"
        data-testid="crypto-generate-btn"
      >
        {busy ? "Generating address…" : `Get ${coin?.ticker || "crypto"} address →`}
      </button>

      <p className="text-center text-[10px] font-mono text-neutral-600">
        Powered by NOWPayments · Non-custodial · No KYC
      </p>
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
