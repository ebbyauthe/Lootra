import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle, AlertCircle, Loader } from "lucide-react";
import { api } from "../lib/api";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState("loading"); // loading | success | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) { setState("error"); setMessage("No verification token found."); return; }
    api.get(`/auth/verify-email?token=${token}`)
      .then(() => setState("success"))
      .catch((err) => {
        setState("error");
        setMessage(err?.response?.data?.detail || "Invalid or expired link.");
      });
  }, [token]);

  return (
    <div className="max-w-md mx-auto py-12 animate-fade-in">
      <div className="lootra-card p-8 flex flex-col items-center gap-4 text-center">
        {state === "loading" && (
          <>
            <Loader className="w-10 h-10 text-neutral-400 animate-spin" />
            <div className="text-sm text-neutral-400">Verifying your email…</div>
          </>
        )}
        {state === "success" && (
          <>
            <div className="w-14 h-14 rounded-full bg-[#CCFF00]/10 border-2 border-[#CCFF00] flex items-center justify-center">
              <CheckCircle className="w-7 h-7 text-[#CCFF00]" />
            </div>
            <div>
              <div className="text-lg font-medium text-white">Email verified!</div>
              <div className="text-sm text-neutral-400 mt-1">Your account is now active.</div>
            </div>
            <Link to="/login" className="lootra-btn-primary mt-2">Sign in</Link>
          </>
        )}
        {state === "error" && (
          <>
            <AlertCircle className="w-10 h-10 text-[#FF453A]" />
            <div>
              <div className="text-sm font-medium text-[#FF453A]">{message}</div>
            </div>
            <Link to="/login" className="text-sm text-neutral-500 hover:text-white transition-colors mt-1">
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
