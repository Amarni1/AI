import { motion } from "framer-motion";

function compactAddress(value) {
  const safeValue = String(value || "");

  if (!safeValue) {
    return "Not configured";
  }

  if (safeValue.length <= 18) {
    return safeValue;
  }

  return `${safeValue.slice(0, 10)}...${safeValue.slice(-6)}`;
}

export default function ReservePanel({ config }) {
  const badges = [
    {
      label: "Mode",
      ok: true,
      value: config.modeLabel || "Direct On-Chain Mode"
    },
    {
      label: "Signal recipient",
      ok: Boolean(config.recipientAddress),
      value: compactAddress(config.recipientAddress)
    },
    {
      label: "Signal amount",
      ok: Boolean(config.signalAmount),
      value: config.signalAmount ? `${config.signalAmount} MINIMA` : "Using default signal amount"
    }
  ];

  return (
    <section className="panel-surface p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="section-kicker">Direct On-Chain Mode</p>
          <h2 className="mt-2 font-display text-3xl font-semibold text-slate-900 dark:text-white">
            MiniMask execution profile
          </h2>
        </div>
        <span
          className={[
            "rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em]",
            "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
          ].join(" ")}
        >
          Client-side flow
        </span>
      </div>

      <div className="mt-5 grid gap-3">
        {badges.map((item) => (
          <div key={item.label} className="surface-muted p-4">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-400 dark:text-slate-500">
                {item.label}
              </p>
              <span
                className={[
                  "rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em]",
                  item.ok
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                    : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"
                ].join(" ")}
              >
                {item.ok ? "Ready" : "Pending"}
              </span>
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-[22px] border border-slate-200 bg-[#fff9e8] px-4 py-4 text-sm text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
        {config.message}
      </div>

      <div className="mt-5 rounded-[22px] border border-amber-200 bg-[#fff9e8] px-4 py-4 text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
        Tokens without configured ids fall back to metadata-only on-chain requests. Add token ids for both sides to make the signal include the source asset directly.
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {config.tokens?.map((token, index) => (
          <motion.div
            key={token.symbol}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            className="surface-muted p-4"
          >
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-ma-gold">
              {token.symbol}
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
              ${token.price}
            </p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              {token.configured ? "Token id ready" : "Metadata-only fallback"}
            </p>
            <p className="mt-2 break-all text-xs text-slate-500 dark:text-slate-400">
              {token.tokenId || "Token id not configured"}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
