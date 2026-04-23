import { useState } from "react";
import { api } from "../services/api";
import LoadingDots from "./LoadingDots";

const suggestions = [
  "Swap 5 minima to usdc",
  "Convert 10 ma to minima",
  "Show token prices",
  "How much is 25 minima in usdt?"
];

export default function AISwapWidget({ onQuote }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState("Ask for a quote, prices, or the best token to swap into.");
  const [quote, setQuote] = useState(null);
  const [priceTable, setPriceTable] = useState([]);

  async function runPrompt(message) {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      return;
    }

    setLoading(true);
    setInput("");
    try {
      const result = await api.sendMessage(trimmedMessage);
      setReply(result.reply ?? result.message);
      setQuote(result.swapQuote ?? null);
      setPriceTable(result.priceTable ?? []);
    } catch (error) {
      setReply(error.message);
      setQuote(null);
      setPriceTable([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await runPrompt(input);
  }

  return (
    <section className="surface-muted p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="section-kicker">AI Swap</p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
            Natural language execution
          </h3>
        </div>
        <div className="rounded-full bg-[#fff7dd] px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-slate-900 dark:bg-ma-gold dark:text-slate-950">
          AI
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          className="input-premium min-h-28"
          placeholder="Swap 10 minima to usdt"
        />
        <button type="submit" disabled={loading} className="btn-gold w-full justify-center disabled:pointer-events-none disabled:opacity-60">
          {loading ? "Thinking..." : "Execute AI Swap"}
        </button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => runPrompt(suggestion)}
            className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-700 transition hover:-translate-y-0.5 hover:border-ma-gold hover:text-ma-gold dark:border-white/10 dark:bg-slate-950 dark:text-slate-200"
          >
            {suggestion}
          </button>
        ))}
      </div>

      <div className="mt-5 rounded-[24px] border border-[#ecd79a] bg-[#fffaf0] p-4 dark:border-white/10 dark:bg-slate-950">
        {loading ? (
          <LoadingDots label="Generating swap response" />
        ) : (
          <p className="text-sm leading-7 text-slate-700 dark:text-slate-200">{reply}</p>
        )}
      </div>

      {quote ? (
        <div className="mt-4 rounded-[24px] border border-[#ecd79a] bg-white p-4 dark:border-white/10 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
            Quote Ready
          </p>
          <p className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">
            {quote.amount} {quote.fromToken} = {quote.receiveAmount} {quote.toToken}
          </p>
          <button onClick={() => onQuote(quote)} className="btn-gold mt-4 justify-center">
            Confirm Quote
          </button>
        </div>
      ) : null}

      {priceTable.length ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {priceTable.map((item) => (
            <div key={item.token} className="rounded-[20px] border border-black/10 bg-white px-4 py-3 text-sm font-bold text-slate-800 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100">
              {item.token}: ${item.price}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
