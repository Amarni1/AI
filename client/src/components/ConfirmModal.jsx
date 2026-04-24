import { AnimatePresence, motion } from "framer-motion";

export default function ConfirmModal({
  confirmLabel = "Confirm in MiniMask",
  description = "",
  details = [],
  message,
  onCancel,
  onConfirm,
  open,
  title = "Confirm Transaction"
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-md"
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16 }}
            className="w-full max-w-xl rounded-[30px] border border-[#e5c76f]/70 bg-[linear-gradient(180deg,rgba(255,252,244,0.98),rgba(250,243,223,0.95))] p-6 shadow-[0_30px_70px_rgba(15,23,42,0.24)] backdrop-blur-2xl dark:border-[#e5c76f]/20 dark:bg-[linear-gradient(180deg,rgba(5,5,5,0.96),rgba(17,17,17,0.96))]"
          >
            <p className="section-kicker">Confirmation Required</p>
            <h2 className="mt-3 font-display text-3xl font-semibold text-slate-900 dark:text-white">
              {title}
            </h2>
            {description ? (
              <p className="mt-4 text-base font-semibold leading-7 text-slate-700 dark:text-slate-200">
                {description}
              </p>
            ) : null}

            {details.length ? (
              <div className="mt-5 grid gap-3">
                {details.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[20px] border border-black/10 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-white/5"
                  >
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-slate-400 dark:text-slate-500">
                      {item.label}
                    </p>
                    <p className="mt-2 text-base font-bold text-slate-900 dark:text-white">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            {message ? (
              <p className="mt-4 text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
                {message}
              </p>
            ) : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button onClick={onCancel} className="btn-secondary flex-1 justify-center">
                Cancel
              </button>
              <button onClick={onConfirm} className="btn-gold flex-1 justify-center">
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
