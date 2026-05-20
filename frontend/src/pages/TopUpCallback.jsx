import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle, XCircle, Loader } from "lucide-react";
import { api, formatError } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function TopUpCallback() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { refresh } = useAuth();

  const status = params.get("status");
  const txRef = params.get("tx_ref");
  const transactionId = params.get("transaction_id");

  const [state, setState] = useState("verifying"); // verifying | success | failed | cancelled
  const [credited, setCredited] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (status === "cancelled") { setState("cancelled"); return; }
    if (!txRef || !transactionId) { setState("failed"); setError("Missing transaction details"); return; }

    api
      .post(`/wallet/fiat-verify?transaction_id=${transactionId}&tx_ref=${txRef}`)
      .then(async ({ data }) => {
        await refresh();
        setCredited(data.credited_usd ?? null);
        setState("success");
      })
      .catch((e) => {
        setError(formatError(e));
        setState("failed");
      });
  }, []);

  return (
    <div className="max-w-md mx-auto flex flex-col items-center justify-center min-h-[50vh] text-center space-y-6 animate-fade-in">
      {state === "verifying" && (
        <>
          <Loader className="w-10 h-10 text-[#CCFF00] animate-spin" />
          <div>
            <h2 className="text-xl font-medium">Verifying payment…</h2>
            <p className="text-sm text-neutral-400 mt-1">Please wait while we confirm your transaction.</p>
          </div>
        </>
      )}

      {state === "success" && (
        <>
          <CheckCircle className="w-12 h-12 text-[#CCFF00]" />
          <div>
            <h2 className="text-xl font-medium">Wallet topped up!</h2>
            {credited != null && (
              <p className="text-sm text-neutral-400 mt-1 font-mono">
                +${credited.toFixed(4)} USD added to your wallet
              </p>
            )}
          </div>
          <button onClick={() => nav("/dashboard")} className="lootra-btn-primary">
            Go to Dashboard
          </button>
        </>
      )}

      {state === "cancelled" && (
        <>
          <XCircle className="w-12 h-12 text-neutral-500" />
          <div>
            <h2 className="text-xl font-medium">Payment cancelled</h2>
            <p className="text-sm text-neutral-400 mt-1">No funds were deducted.</p>
          </div>
          <button onClick={() => nav("/topup")} className="lootra-btn-secondary">
            Try again
          </button>
        </>
      )}

      {state === "failed" && (
        <>
          <XCircle className="w-12 h-12 text-[#FF453A]" />
          <div>
            <h2 className="text-xl font-medium">Verification failed</h2>
            {error && <p className="text-sm text-neutral-400 mt-1 font-mono">{error}</p>}
            <p className="text-xs text-neutral-500 mt-2">If you were charged, contact support with your reference: {txRef}</p>
          </div>
          <button onClick={() => nav("/topup")} className="lootra-btn-secondary">
            Back to Top Up
          </button>
        </>
      )}
    </div>
  );
}
