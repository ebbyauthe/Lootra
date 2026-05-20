import React, { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Shield, Wallet, LogOut, ShieldCheck, Menu, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const navItem = ({ isActive }) =>
  `px-4 py-2 text-sm tracking-tight transition-colors ${
    isActive ? "text-[#CCFF00]" : "text-neutral-400 hover:text-white"
  }`;

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-neutral-100 flex flex-col">
      <header className="border-b border-[#2A2A2A] sticky top-0 z-30 bg-[#0A0A0A]/90 backdrop-blur">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2" data-testid="logo-link">
            <div className="w-8 h-8 bg-[#CCFF00] flex items-center justify-center">
              <Shield className="w-4 h-4 text-black" strokeWidth={2.5} />
            </div>
            <span className="font-medium text-lg tracking-tight">LOOTRA</span>
            <span className="hidden sm:inline-block lootra-badge ml-2" data-testid="badge-beta">BETA</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            <NavLink to="/browse" className={navItem} data-testid="nav-browse">Browse</NavLink>
            {user?.role !== "admin" && <NavLink to="/sell" className={navItem} data-testid="nav-sell">Sell</NavLink>}
            {user && user.role !== "admin" && <NavLink to="/dashboard" className={navItem} data-testid="nav-dashboard">Dashboard</NavLink>}
            {user?.role === "admin" && <NavLink to="/admin" className={navItem} data-testid="nav-admin">Admin</NavLink>}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                <div className="flex items-center gap-2 px-3 py-2 border border-[#2A2A2A]" data-testid="user-balance">
                  <Wallet className="w-4 h-4 text-[#CCFF00]" />
                  <span className="font-mono text-xs text-neutral-300">${user.balance?.toFixed(2)}</span>
                </div>
                <Link to={`/user/${user.username}`} className="text-sm text-neutral-400 hover:text-white hover:underline" data-testid="user-username">@{user.username}</Link>
                <button onClick={async () => { await logout(); nav("/"); }} className="lootra-btn-secondary !py-2 !px-3" data-testid="logout-btn">
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="lootra-btn-secondary !py-2 !px-4" data-testid="login-btn">Sign in</Link>
                <Link to="/register" className="lootra-btn-primary !py-2 !px-4" data-testid="register-btn">Get started</Link>
              </>
            )}
          </div>

          <button className="md:hidden p-2" onClick={() => setOpen(!open)} data-testid="mobile-menu-toggle">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {open && (
          <div className="md:hidden border-t border-[#2A2A2A] bg-[#0A0A0A] px-6 py-4 flex flex-col gap-3">
            {user && (
              <div className="flex items-center justify-between py-2 border-b border-[#2A2A2A] mb-1">
                <Link to={`/user/${user.username}`} onClick={() => setOpen(false)} className="text-sm font-medium text-[#CCFF00] hover:underline">@{user.username}</Link>
                <div className="flex items-center gap-1 font-mono text-xs text-neutral-300">
                  <Wallet className="w-3.5 h-3.5 text-[#CCFF00]" />${user.balance?.toFixed(2)}
                </div>
              </div>
            )}
            <NavLink to="/browse" className={navItem} onClick={() => setOpen(false)}>Browse</NavLink>
            {user?.role !== "admin" && <NavLink to="/sell" className={navItem} onClick={() => setOpen(false)}>Sell</NavLink>}
            {user && user.role !== "admin" && <NavLink to="/dashboard" className={navItem} onClick={() => setOpen(false)}>Dashboard</NavLink>}
            {user?.role === "admin" && <NavLink to="/admin" className={navItem} onClick={() => setOpen(false)}>Admin</NavLink>}
            {!user && (
              <div className="flex gap-2 pt-2">
                <Link to="/login" className="lootra-btn-secondary flex-1 text-center" onClick={() => setOpen(false)}>Sign in</Link>
                <Link to="/register" className="lootra-btn-primary flex-1 text-center" onClick={() => setOpen(false)}>Sign up</Link>
              </div>
            )}
            {user && (
              <button onClick={async () => { await logout(); setOpen(false); nav("/"); }} className="lootra-btn-secondary mt-1">Logout</button>
            )}
          </div>
        )}
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10">{children}</main>

      <footer className="border-t border-[#2A2A2A] mt-16">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-neutral-500 font-mono">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#CCFF00]" />
            <span>LOOTRA // ESCROW-PROTECTED ACCOUNT MARKETPLACE</span>
          </div>
          <div>© {new Date().getFullYear()} — All transactions held in escrow.</div>
        </div>
      </footer>
    </div>
  );
}
