import { motion } from "framer-motion";
import {
  formatDisplayedAmount,
  getOwnedTokenBalances,
  sortBalancesByOwnership
} from "../services/walletPortfolio";
import { formatWalletAddress } from "../services/walletData";
import LoadingDots from "./LoadingDots";

export default function WalletCard({
  address,
  balance,
  connected,
  error,
  isAvailable,
  isChecking,
  isSyncing,
  onConnect,
  onInstall,
  onRefresh,
  tokenBalances = []
}) {
  const orderedBalances = sortBalancesByOwnership(tokenBalances);
  const ownedBalances = getOwnedTokenBalances(tokenBalances);
  const visibleBalances = orderedBalances.slice(0, 4);

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      className="panel-surface overflow-hidden p-5"
    >
      <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(135deg,rgba(212,175,55,0.22),rgba(255,255,255,0))] dark:bg-[linear-gradient(135deg,rgba(212,175,55,0.18),rgba(15,23,42,0))]" />
      <div className="relative space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="section-kicker">Wallet</p>
              <span
                className={[
                  "rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.24em]",
                  connected
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                    : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"
                ].join(" ")}
              >
                {connected ? "Connected" : "Idle"}
              </span>
              {connected ? (
                <span className="rounded-full bg-ma-gold/15 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.22em] text-ma-gold">
                  {formatWalletAddress(address)}
                </span>
              ) : null}
            </div>
            <h2 className="mt-3 font-display text-3xl font-semibold text-slate-900 dark:text-white">
              MiniMask sendable balances
            </h2>
            <p className="mt-2 text-sm font-semibold leading-7 text-slate-700 dark:text-slate-200">
              Live wallet balances are loaded from MiniMask sendable data so the UI only enables actions you can actually sign.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={onConnect}
              disabled={!isAvailable || isSyncing}
              className="btn-gold disabled:pointer-events-none disabled:opacity-60"
            >
              {isChecking ? "Detecting..." : connected ? "Reconnect" : "Connect Wallet"}
            </button>
            <button
              onClick={onRefresh}
              disabled={!isAvailable || isSyncing}
              className="btn-secondary disabled:pointer-events-none disabled:opacity-60"
            >
              {isSyncing ? "Refreshing..." : "Refresh Everything"}
            </button>
            {!isAvailable ? (
              <button onClick={onInstall} className="btn-secondary">
                Install MiniMask
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span
            className={
              isAvailable
                ? "rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                : "rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
            }
          >
            {isAvailable
              ? "MiniMask detected"
              : isChecking
                ? "Waiting for extension"
                : "MiniMask unavailable"}
          </span>
          <span
            className={
              ownedBalances.length
                ? "rounded-full bg-ma-gold/15 px-3 py-1 font-semibold text-ma-gold"
                : "rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300"
            }
          >
            {ownedBalances.length
              ? `${ownedBalances.length} owned token${ownedBalances.length === 1 ? "" : "s"}`
              : "Zero sendable balance"}
          </span>
          {isChecking || isSyncing ? <LoadingDots label="Syncing wallet" /> : null}
          {error ? <span className="font-semibold text-red-700 dark:text-red-300">{error}</span> : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="surface-muted p-5">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">
              Wallet address
            </p>
            <p className="mt-3 break-all font-mono text-sm leading-7 text-slate-800 dark:text-slate-100">
              {address || "No wallet connected yet"}
            </p>
          </div>

          <div className="surface-muted bg-[linear-gradient(135deg,rgba(212,175,55,0.12),rgba(255,255,255,0.92))] p-5 dark:bg-[linear-gradient(135deg,rgba(212,175,55,0.18),rgba(255,255,255,0.03))]">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">
              Primary sendable
            </p>
            <p className="mt-3 font-display text-4xl font-semibold text-slate-900 dark:text-white">
              {balance || "--"}
            </p>
            <p className="mt-2 text-sm font-bold text-ma-gold">
              {ownedBalances[0]?.symbol || visibleBalances[0]?.token || "MINIMA"}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {visibleBalances.length ? (
            visibleBalances.map((token, index) => (
              <motion.div
                key={token.id || token.token}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="surface-muted p-4"
              >
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">
                  {token.symbol || token.token}
                </p>
                <p className="mt-3 text-2xl font-black text-slate-900 dark:text-white">
                  {formatDisplayedAmount(token.sendable ?? token.amount)}
                </p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  {Number(token.sendable ?? token.amount) > 0 ? "Sendable now" : "Unavailable"}
                </p>
              </motion.div>
            ))
          ) : (
            <div className="surface-muted col-span-full p-5 text-sm font-semibold text-slate-500 dark:text-slate-300">
              Connect and refresh MiniMask to load live token balances.
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
}
