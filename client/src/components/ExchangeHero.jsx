import { motion } from "framer-motion";
import { getTokenPriceCards } from "../services/swapEngine";

export default function ExchangeHero({ onOpen }) {
  const prices = getTokenPriceCards();

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="panel-surface overflow-hidden p-6"
    >
      <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.18),transparent_60%)]" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="section-kicker">Minima AI Swap Assistant</p>
          <h2 className="mt-3 font-display text-4xl font-semibold text-slate-900 dark:text-white sm:text-5xl">
            Intelligent token quotes with premium swap UX
          </h2>
          <p className="mt-4 text-sm leading-7 text-slate-700 dark:text-slate-200">
            Compare token conversions instantly, ask swap questions in natural language,
            and route confirmed swaps through the same premium status flow.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {prices.map((item) => (
              <div
                key={item.token}
                className="rounded-full border border-[#ecd79a] bg-[#fff7dd] px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-slate-800 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
              >
                {item.token} ${item.price}
              </div>
            ))}
          </div>
        </div>

        <button onClick={onOpen} className="btn-gold min-w-[220px] justify-center self-start lg:self-auto">
          Open Exchange
        </button>
      </div>
    </motion.section>
  );
}
