import React from "react";
import { Check } from "lucide-react";

const STEPS = [
  { key: "PAID", label: "Funds Held" },
  { key: "DELIVERED", label: "Credentials Released" },
  { key: "CONFIRMED", label: "Buyer Confirmed" },
  { key: "RELEASED", label: "Seller Paid" },
];

export default function EscrowStepper({ status }) {
  if (status === "DISPUTED" || status === "REFUNDED") {
    return (
      <div className="border border-[#FF453A]/40 bg-[#FF453A]/5 p-4 font-mono text-xs text-[#FF453A]" data-testid="escrow-status-text">
        STATUS: {status} — admin review in progress.
      </div>
    );
  }
  const currentIdx = STEPS.findIndex((s) => s.key === status);
  return (
    <div className="border border-[#2A2A2A] p-6 bg-[#121212]" data-testid="escrow-stepper">
      <div className="text-[10px] tracking-[0.2em] uppercase text-neutral-500 font-mono mb-4">Escrow Timeline</div>
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        {STEPS.map((s, i) => {
          const done = i <= currentIdx;
          const active = i === currentIdx;
          return (
            <React.Fragment key={s.key}>
              <div className="flex flex-col items-center min-w-[80px]" data-testid={`escrow-step-${s.key}`}>
                <div className={`w-8 h-8 flex items-center justify-center border ${
                  done ? "border-[#CCFF00] bg-[#CCFF00] text-black" : "border-[#2A2A2A] text-neutral-500"
                }`}>
                  {done ? <Check className="w-4 h-4" /> : <span className="font-mono text-xs">{i + 1}</span>}
                </div>
                <div className={`mt-2 text-[10px] tracking-wider uppercase font-mono text-center ${
                  active ? "text-[#CCFF00]" : done ? "text-neutral-300" : "text-neutral-600"
                }`}>{s.label}</div>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px ${i < currentIdx ? "bg-[#CCFF00]" : "bg-[#2A2A2A]"}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
