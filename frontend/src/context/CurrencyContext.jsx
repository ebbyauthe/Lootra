import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";

export const CURRENCIES = [
  { code: "USD", symbol: "$",   name: "US Dollar",         flag: "🇺🇸" },
  { code: "CAD", symbol: "CA$", name: "Canadian Dollar",   flag: "🇨🇦" },
  { code: "GBP", symbol: "£",   name: "British Pound",     flag: "🇬🇧" },
  { code: "EUR", symbol: "€",   name: "Euro",              flag: "🇪🇺" },
  { code: "NGN", symbol: "₦",   name: "Nigerian Naira",    flag: "🇳🇬" },
  { code: "GHS", symbol: "₵",   name: "Ghanaian Cedi",     flag: "🇬🇭" },
];

const FALLBACK_RATES = { USD: 1, CAD: 1.37, GBP: 0.79, EUR: 0.92, NGN: 1550, GHS: 15.5 };

const CurrencyContext = createContext(null);

export function CurrencyProvider({ children }) {
  const [currency, setCurrencyState] = useState(
    () => localStorage.getItem("lootra_currency") || "USD"
  );
  const [rates, setRates] = useState(FALLBACK_RATES);

  const fetchRates = useCallback(async () => {
    try {
      const { data } = await api.get("/currency/rates");
      setRates(data);
    } catch {}
  }, []);

  useEffect(() => { fetchRates(); }, [fetchRates]);

  const setCurrency = (code) => {
    setCurrencyState(code);
    localStorage.setItem("lootra_currency", code);
  };

  const formatPrice = (usdAmount) => {
    if (usdAmount == null) return "—";
    const rate = rates[currency] ?? 1;
    const converted = usdAmount * rate;
    const curr = CURRENCIES.find((c) => c.code === currency);
    const sym = curr?.symbol ?? "$";
    if (currency === "NGN" || currency === "GHS") {
      return `${sym}${Math.round(converted).toLocaleString()}`;
    }
    return `${sym}${converted.toFixed(2)}`;
  };

  const toUSD = (amount, fromCurrency) => {
    const rate = rates[fromCurrency] ?? 1;
    return amount / rate;
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, rates, formatPrice, toUSD, CURRENCIES }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export const useCurrency = () => useContext(CurrencyContext);
