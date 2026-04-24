import { NavLink, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import ThemeToggle from "./ThemeToggle";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/wallet", label: "Wallet" },
  { to: "/transactions", label: "History" }
];

export default function Navbar({ isDark, onOpenExchange, onToggleTheme }) {
  const navigate = useNavigate();

  function handleOpenExchange() {
    navigate("/");
    onOpenExchange?.();
  }

  return (
    <motion.header
      initial={{ opacity: 0, y: -18 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8 rounded-[34px] border border-black/5 bg-white/95 px-5 py-5 shadow-card backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/95 sm:px-6"
    >
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-4">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-[22px] border border-white/60 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.95),rgba(255,255,255,0.4)_30%,rgba(212,175,55,0.38)_100%)] shadow-[0_18px_40px_rgba(212,175,55,0.18)] dark:border-white/10 dark:bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),rgba(212,175,55,0.22)_45%,rgba(15,23,42,0.95)_100%)]">
            <div className="absolute inset-1 rounded-[18px] border border-white/50 dark:border-white/10" />
            <span className="relative font-display text-3xl font-semibold tracking-[0.2em] text-slate-900 dark:text-white">
              MA
            </span>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.45em] text-ma-gold">
              Minima Finance
            </p>
            <h1 className="mt-1 font-display text-3xl font-semibold text-slate-900 dark:text-white sm:text-4xl">
              Minima Finance Portal
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium text-slate-700 dark:text-slate-200">
              Secure wallet access, token exchange, live balances, and blockchain settlement tools powered by MiniMask.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 xl:items-end">
          <div className="flex items-center gap-3 self-start xl:self-auto">
            <div className="hidden rounded-full border border-white/70 bg-white/80 px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-slate-500 shadow-[0_12px_30px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/5 dark:text-slate-300 sm:block">
              Live Wallet + Network Data
            </div>
            <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
          </div>

          <nav className="flex flex-wrap gap-3">
            <button type="button" onClick={handleOpenExchange} className="btn-secondary">
              Exchange
            </button>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  isActive
                    ? "btn-gold"
                    : "btn-secondary"
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
    </motion.header>
  );
}
