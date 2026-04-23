import { motion } from "framer-motion";

export default function StatusPanel({ connected, status, tokenCount }) {
  const cards = [
    {
      label: "Connection",
      value: connected ? "Active wallet session" : "Awaiting wallet",
      accent: connected ? "text-emerald-600 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"
    },
    {
      label: "Assets",
      value: `${tokenCount} tracked token${tokenCount === 1 ? "" : "s"}`,
      accent: "text-slate-900 dark:text-white"
    },
    {
      label: "Assistant",
      value: "Ready for wallet, education, and blockchain help",
      accent: "text-slate-900 dark:text-white"
    }
  ];

  return (
    <section className="panel-surface p-6">
      <p className="section-kicker">System Status</p>
      <div className="mt-4 space-y-4">
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
