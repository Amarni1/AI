import { motion } from "framer-motion";
import LoadingDots from "./LoadingDots";
import { formatWalletAddress } from "../services/walletData";

export default function WalletCard({
  address,
  balance,
  connected,
  error,
  isAvailable,
  isChecking,
  onConnect,
  onInstall,
  onRefresh,
  tokenBalances = []
}) {
  const visibleBalances = tokenBalances.length
    ? tokenBalances.slice(0, 4)
    : connected
      ? [{ id: "minima", token: "Minima", amount: balance || "--" }]
      : [];

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      className="panel-surface overflow-hidden p-6"
    >
      <div className="absolute inset-x-0 top-0 h-28 bg-[linear-gradient(135deg,rgba(212,175,55,0.22),rgba(255,255,255,0))] dark:bg-[linear-gradient(135deg,rgba(212,175,55,0.2),rgba(15,23,42,0))]" />
      <div className="relative flex flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <p className="section-kicker">Wallet</p>
              <span
                className={[
                  "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em]",
                  connected
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                    : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"
                ].join(" ")}
              >
                {connected ? "Connected" : "Idle"}
              </span>
              {connected ? (
                <span className="rounded-full bg-ma-gold/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-ma-gold">
                  {formatWalletAddress(address)}
                </span>
              ) : null}
            </div>
            <h2 className="mt-3 font-display text-3xl font-semibold text-slate-900 dark:text-white">
              MiniMask control center
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
              Securely inspect sendable balances, refresh wallet data, and prepare direct
              on-chain swap signals for MiniMask confirmation.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={onConnect} disabled={!isAvailable} className="btn-gold">
              {isChecking ? "Detecting..." : connected ? "Reconnect" : "Connect Wallet"}
            </button>
            <button onClick={onRefresh} disabled={!isAvailable} className="btn-secondary">
              Refresh Data
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
                ? "rounded-full bg-emerald-100 px-3 py-1 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                : "rounded-full bg-amber-100 px-3 py-1 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
            }
          >
            {isAvailable
              ? "MiniMask detected"
              : isChecking
                ? "Waiting for extension"
                : "MiniMask unavailable"}
          </span>
          {isChecking ? <LoadingDots label="Syncing wallet access" /> : null}
          {error ? <span className="text-red-700 dark:text-red-300">{error}</span> : null}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="surface-muted p-5">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">
              Wallet address
            </p>
            <p className="mt-3 break-all font-mono text-sm leading-7 text-slate-800 dark:text-slate-100">
              {address || "No wallet connected yet"}
            </p>
            <p className="mt-3 text-xs uppercase tracking-[0.28em] text-slate-400 dark:text-slate-500">
              {formatWalletAddress(address)}
            </p>
          </div>

          <div className="surface-muted bg-[linear-gradient(135deg,rgba(212,175,55,0.12),rgba(255,255,255,0.88))] p-5 dark:bg-[linear-gradient(135deg,rgba(212,175,55,0.18),rgba(255,255,255,0.03))]">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">
              Primary sendable
            </p>
            <p className="mt-3 font-display text-4xl font-semibold text-slate-900 dark:text-white">
              {balance || "--"}
            </p>
            <p className="mt-2 text-sm text-ma-gold">
              {visibleBalances[0]?.token || "Minima"}
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
                transition={{ delay: index * 0.06 }}
                className="surface-muted p-4"
              >
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">
                  {token.token}
                </p>
                <p className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">
                  {token.amount}
                </p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {token.tokenId || "Native token"}
                </p>
              </motion.div>
            ))
          ) : (
            <div className="surface-muted col-span-full p-5 text-sm text-slate-500 dark:text-slate-300">
              Connect and refresh MiniMask to load token balances.
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
}
