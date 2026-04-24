import { motion } from "framer-motion";

function compactAddress(value) {
  const safeValue = String(value || "");

  if (!safeValue) {
    return "Connect MiniMask";
  }

  if (safeValue.length <= 18) {
    return safeValue;
  }

  return `${safeValue.slice(0, 10)}...${safeValue.slice(-6)}`;
}

export default function SwapCard({
  availableTokens,
  connected,
  form,
  onExecute,
  onFlip,
  onSetField,
  previewQuote,
  quote,
  quoteLoading,
  routeAddress,
  swapLoading
}) {
  const activeQuote = quote || previewQuote;
  const routeNote = !activeQuote
    ? "Enter an amount to preview the on-chain signal."
    : activeQuote.metadataOnly
      ? "Metadata-only signal. Configure token ids for both assets to include the source token directly."
      : "Token-aware signal ready for MiniMask signing.";

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      className="panel-surface overflow-hidden p-6"
    >
      <div className="absolute inset-x-0 top-0 h-36 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.24),transparent_70%)]" />
      <div className="relative">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-kicker">Direct Swap</p>
            <h2 className="mt-2 font-display text-4xl font-semibold text-slate-900 dark:text-white">
              Sign a real on-chain swap request
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-700 dark:text-slate-200">
              Sign in MiniMask, embed the quote in Minima state variables, and track the txpow
              until the network confirms it.
            </p>
          </div>
          <div className="rounded-full bg-slate-950 px-4 py-2 text-xs font-bold uppercase tracking-[0.28em] text-ma-gold dark:bg-ma-gold dark:text-slate-950">
            Local quote + chain confirmation
          </div>
        </div>

        <div className="mt-6 rounded-[32px] border border-[#e5c76f] bg-[linear-gradient(180deg,#0a0a0a_0%,#121212_100%)] p-4 shadow-[0_40px_80px_rgba(15,23,42,0.28)] sm:p-5">
          <div className="rounded-[26px] border border-white/10 bg-white/5 p-4 sm:p-5">
            <div className="rounded-[26px] border border-white/10 bg-black/50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-white/60">
                  From
                </p>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-ma-gold">
                  Swap input
                </p>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_150px]">
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={form.amount}
                  onChange={(event) => onSetField("amount", event.target.value)}
                  className="w-full bg-transparent text-4xl font-extrabold text-white outline-none placeholder:text-white/20"
                  placeholder="0.0"
                />
                <select
                  value={form.fromToken}
                  onChange={(event) => onSetField("fromToken", event.target.value)}
                  className="input-premium !rounded-[20px] !border-white/10 !bg-[#151515] !text-white"
                >
                  {availableTokens.map((token) => (
                    <option key={token} value={token}>
                      {token}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-center py-3">
              <button
                type="button"
                onClick={onFlip}
                className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-[#e5c76f] bg-[linear-gradient(180deg,#fdf1b8_0%,#e0ba43_45%,#a87910_100%)] text-2xl font-black text-slate-950 shadow-[0_18px_30px_rgba(212,175,55,0.3)] transition hover:-translate-y-1"
              >
                {"><"}
              </button>
            </div>

            <div className="rounded-[26px] border border-white/10 bg-black/50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-white/60">
                  To
                </p>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-ma-gold">
                  Quoted output
                </p>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_150px]">
                <div className="text-4xl font-extrabold text-white">
                  {previewQuote ? previewQuote.receiveAmount : "0.0000"}
                </div>
                <select
                  value={form.toToken}
                  onChange={(event) => onSetField("toToken", event.target.value)}
                  className="input-premium !rounded-[20px] !border-white/10 !bg-[#151515] !text-white"
                >
                  {availableTokens.map((token) => (
                    <option key={token} value={token}>
                      {token}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-5 grid gap-4 rounded-[24px] border border-white/10 bg-white/5 p-4 sm:grid-cols-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/45">
                  Indicative value
                </p>
                <p className="mt-2 text-lg font-extrabold text-white">
                  ${previewQuote?.usdValue || "0.00"}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/45">
                  Signal recipient
                </p>
                <p className="mt-2 text-sm font-semibold text-white">
                  {compactAddress(routeAddress)}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/45">
                  Route status
                </p>
                <p className="mt-2 text-sm font-semibold text-ma-gold">
                  {routeNote}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onExecute}
              disabled={swapLoading || quoteLoading || !connected || !previewQuote}
              className="btn-gold mt-5 w-full justify-center disabled:pointer-events-none disabled:opacity-60"
            >
              {swapLoading
                ? "Submitting Request"
                : quoteLoading
                  ? "Preparing Quote"
                  : connected
                    ? "Sign Swap Request"
                    : "Connect Wallet First"}
            </button>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
