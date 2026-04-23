export default function SendPanel({
  connected,
  sendAddress,
  sendAmount,
  setSendAddress,
  setSendAmount,
  onSubmit
}) {
  return (
    <section className="panel-surface p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="section-kicker">Payments</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
            Create secure Minima transfers
          </h2>
        </div>
        <span
          className={[
            "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em]",
            connected
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
              : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
          ].join(" ")}
        >
          {connected ? "Wallet ready" : "Connect first"}
        </span>
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-[0.8fr_1.2fr]">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
              Amount
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={sendAmount}
              onChange={(event) => setSendAmount(event.target.value)}
              className="input-premium"
              placeholder="2.50"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
              Recipient
            </span>
            <input
              value={sendAddress}
              onChange={(event) => setSendAddress(event.target.value)}
              className="input-premium"
              placeholder="Mx123..."
            />
          </label>
        </div>

        <button type="submit" className="btn-gold w-full justify-center">
          Review Transaction
        </button>
      </form>
    </section>
  );
}
