import { useMemo, useState } from "react";
import { convertSwapAmount, TOKEN_OPTIONS } from "../services/swapEngine";

export default function ManualSwapWidget({ onQuote }) {
  const [fromToken, setFromToken] = useState("MINIMA");
  const [toToken, setToToken] = useState("USDT");
  const [amount, setAmount] = useState("10");

  const quote = useMemo(
    () => convertSwapAmount(amount, fromToken, toToken),
    [amount, fromToken, toToken]
  );

  function handleSwap(event) {
    event.preventDefault();
    if (!quote) {
      return;
    }

    onQuote(quote);
  }

  return (
    <section className="surface-muted p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="section-kicker">Manual Swap</p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
            Build your quote
          </h3>
        </div>
        <div className="rounded-full bg-slate-950 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-ma-gold dark:bg-ma-gold dark:text-slate-950">
          Manual
        </div>
      </div>

      <form onSubmit={handleSwap} className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
              From token
            </span>
            <select
              value={fromToken}
              onChange={(event) => setFromToken(event.target.value)}
              className="input-premium"
            >
              {TOKEN_OPTIONS.map((token) => (
                <option key={token} value={token}>
                  {token}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
              To token
            </span>
            <select
              value={toToken}
              onChange={(event) => setToToken(event.target.value)}
              className="input-premium"
            >
              {TOKEN_OPTIONS.map((token) => (
                <option key={token} value={token}>
                  {token}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
            Amount
          </span>
          <input
            type="number"
            min="0"
            step="0.0001"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="input-premium"
            placeholder="10"
          />
        </label>

        <div className="rounded-[24px] border border-[#ecd79a] bg-[#fffaf0] p-4 dark:border-white/10 dark:bg-slate-950">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
            Estimated receive
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-900 dark:text-white">
            {quote ? `${quote.receiveAmount} ${quote.toToken}` : "--"}
          </p>
          {quote ? (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {quote.amount} {quote.fromToken} = ${quote.usdValue}
            </p>
          ) : null}
        </div>

        <button type="submit" disabled={!quote} className="btn-gold w-full justify-center disabled:pointer-events-none disabled:opacity-60">
          Swap Now
        </button>
      </form>
    </section>
  );
}
