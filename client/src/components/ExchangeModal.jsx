import { AnimatePresence, motion } from "framer-motion";
import ManualSwapWidget from "./ManualSwapWidget";
import AISwapWidget from "./AISwapWidget";

export default function ExchangeModal({ open, onClose, onQuote }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 overflow-y-auto bg-black/70 px-4 py-8 backdrop-blur-md"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20 }}
            className="mx-auto w-full max-w-6xl rounded-[34px] border border-white/15 bg-[linear-gradient(180deg,rgba(6,10,19,0.98),rgba(15,23,42,0.96))] p-6 shadow-[0_40px_90px_rgba(0,0,0,0.4)]"
          >
            <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="section-kicker">Exchange</p>
                <h2 className="mt-2 font-display text-4xl font-semibold text-white">
                  Premium swap workspace
                </h2>
                <p className="mt-3 max-w-3xl text-sm font-medium leading-7 text-slate-300">
                  Build manual quotes, ask the AI for smart conversions, and route approved
                  swaps through MiniMask-aware confirmation flow.
                </p>
              </div>
              <button onClick={onClose} className="btn-secondary self-start !bg-white !text-slate-900">
                Close Exchange
              </button>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <ManualSwapWidget onQuote={onQuote} />
              <AISwapWidget onQuote={onQuote} />
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
