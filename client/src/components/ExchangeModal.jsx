import { AnimatePresence, motion } from "framer-motion";
import DexExchangePanel from "./DexExchangePanel";
import SwapCard from "./SwapCard";

export default function ExchangeModal({
  dexBook,
  mode,
  open,
  onClose,
  ...swapCardProps
}) {
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
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            className="mx-auto w-full max-w-6xl"
          >
            <div className="mb-4 flex justify-end">
              <button onClick={onClose} className="btn-secondary">
                Close
              </button>
            </div>

            {mode === "exchange" ? <DexExchangePanel {...dexBook} /> : <SwapCard {...swapCardProps} />}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
