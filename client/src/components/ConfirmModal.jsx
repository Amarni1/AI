import { AnimatePresence, motion } from "framer-motion";

export default function ConfirmModal({ open, message, onConfirm, onCancel }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-md"
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16 }}
            className="w-full max-w-xl rounded-[30px] border border-white/50 bg-white/90 p-6 shadow-[0_30px_70px_rgba(15,23,42,0.24)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/90"
          >
            <p className="section-kicker">Confirm Transaction</p>
            <h2 className="mt-3 font-display text-3xl font-semibold text-slate-900 dark:text-white">
              Review before MiniMask signs
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-700 dark:text-slate-200">{message}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={onConfirm}
                className="btn-gold flex-1 justify-center"
              >
                Confirm in MiniMask
              </button>
              <button
                onClick={onCancel}
                className="btn-secondary flex-1 justify-center"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
