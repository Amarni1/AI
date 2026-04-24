import { motion } from "framer-motion";
import LoadingDots from "./LoadingDots";

function getFlowBadgeClass(phase) {
  if (phase === "success") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
  }

  if (phase === "submitting") {
    return "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300";
  }

  if (phase === "processing") {
    return "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300";
  }

  if (phase === "submitted") {
    return "bg-slate-950 text-ma-gold dark:bg-white/10";
  }

  if (phase === "timeout") {
    return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300";
  }

  if (phase === "failed") {
    return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300";
  }

  return "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200";
}

export default function StatusPanel({ connected, status, tokenCount, transactionFlow }) {
  const cards = [
    {
      label: "Mode",
      value: "Direct On-Chain Mode",
      accent: "text-slate-900 dark:text-white"
    },
    {
      label: "Assets",
      value: `${tokenCount} sendable token${tokenCount === 1 ? "" : "s"}`,
      accent: "text-slate-900 dark:text-white"
    },
    {
      label: "Connection",
      value: connected ? "MiniMask connected" : "Awaiting wallet",
      accent: connected ? "text-emerald-600 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"
    }
  ];

  return (
    <section className="panel-surface p-6">
      <p className="section-kicker">System Status</p>
      <div className="mt-4 space-y-4">
        {transactionFlow ? (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[28px] bg-[linear-gradient(135deg,rgba(212,175,55,0.2),rgba(255,255,255,0.82))] p-[1px] dark:bg-[linear-gradient(135deg,rgba(212,175,55,0.35),rgba(255,255,255,0.05))]"
          >
            <div className="rounded-[27px] bg-white/95 px-5 py-5 dark:bg-slate-950/85">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] ${getFlowBadgeClass(transactionFlow.phase)}`}>
                  {transactionFlow.badge}
                </span>
                {transactionFlow.phase === "processing" || transactionFlow.phase === "submitting" ? (
                  <LoadingDots label={transactionFlow.phase === "submitting" ? "Waiting for MiniMask" : "Checking txpow"} />
                ) : null}
              </div>
              <h3 className="mt-4 font-display text-2xl font-semibold text-slate-900 dark:text-white">
                {transactionFlow.title}
              </h3>
              <p className="mt-3 text-base text-slate-700 dark:text-slate-200">
                {transactionFlow.summary}
              </p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
                {transactionFlow.detail}
              </p>
            </div>
          </motion.div>
        ) : null}

        <div className="rounded-[28px] bg-[linear-gradient(135deg,rgba(212,175,55,0.18),rgba(255,255,255,0.82))] p-[1px] dark:bg-[linear-gradient(135deg,rgba(212,175,55,0.35),rgba(255,255,255,0.05))]">
          <div className="rounded-[27px] bg-white/90 px-5 py-5 dark:bg-slate-950/80">
            <p className="text-sm leading-7 text-slate-700 dark:text-slate-200">{status}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          {cards.map((item, index) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className="rounded-[24px] border border-white/70 bg-white/85 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/5"
            >
              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400 dark:text-slate-500">
                {item.label}
              </p>
              <p className={`mt-3 text-sm leading-6 ${item.accent}`}>{item.value}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
