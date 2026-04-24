import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { respondToMessage } from "../services/chatEngine";
import { getOwnedTokenBalances, getPortfolioSummary } from "../services/walletPortfolio";
import { formatWalletAddress } from "../services/walletData";
import LoadingDots from "./LoadingDots";

const quickPrompts = [
  "Show my wallet",
  "Refresh balances",
  "What is Minima price?",
  "Show latest block",
  "Swap 5 minima to usdt",
  "Send 2 minima to Mx123",
  "Do I have enough balance?",
  "List my tokens",
  "Open exchange"
];

export default function ChatBox({ onIntent, walletContext = {} }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatBodyRef = useRef(null);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text:
        "Welcome to the Minima Finance Portal. I can surface live balances, token availability, Minima pricing, network block data, and stage secure wallet actions for MiniMask."
    }
  ]);

  const ownedTokens = useMemo(
    () => getOwnedTokenBalances(walletContext.sendableBalances || []),
    [walletContext.sendableBalances]
  );

  const assistantState = walletContext.walletAddress
    ? ownedTokens.length > 0
      ? `Connected to ${formatWalletAddress(walletContext.walletAddress)} with ${getPortfolioSummary(
          walletContext.sendableBalances || []
        )}`
      : `Connected to ${formatWalletAddress(walletContext.walletAddress)} with zero sendable balance`
    : "Connect MiniMask to unlock live wallet balances, prices, blocks, and settlement actions.";

  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function submitMessage(messageText) {
    const trimmedMessage = messageText.trim();
    if (!trimmedMessage) {
      return;
    }

    startTransition(() => {
      setMessages((current) => [...current, { role: "user", text: trimmedMessage }]);
    });
    setInput("");
    setLoading(true);

    try {
      const result = await Promise.resolve(respondToMessage(trimmedMessage, walletContext));
      startTransition(() => {
        setMessages((current) => [
          ...current,
          { role: "assistant", text: result.reply ?? result.message }
        ]);
      });
      onIntent?.(result);
    } catch (error) {
      startTransition(() => {
        setMessages((current) => [...current, { role: "assistant", text: error.message }]);
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await submitMessage(input);
  }

  return (
    <section className="panel-surface flex min-h-[calc(100vh-15rem)] flex-col overflow-hidden p-0">
      <div className="border-b border-black/5 px-6 py-5 dark:border-white/10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="section-kicker">Finance Assistant</p>
            <h2 className="mt-2 font-display text-3xl font-semibold text-slate-900 dark:text-white">
              Conversational wallet operations
            </h2>
            <p className="mt-2 text-sm font-semibold leading-7 text-slate-700 dark:text-slate-200">
              {assistantState}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {quickPrompts.slice(0, 3).map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => submitMessage(prompt)}
                className="btn-secondary !px-4 !py-2 !text-[11px]"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        ref={chatBodyRef}
        className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,249,235,0.98))] px-4 py-6 dark:bg-[linear-gradient(180deg,rgba(1,1,1,0.98),rgba(7,9,16,1))] sm:px-6"
      >
        <div className="mx-auto flex h-full w-full max-w-6xl flex-col">
          <div className="mt-auto space-y-4">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={
                  message.role === "user"
                    ? "ml-auto max-w-[86%] rounded-[24px] bg-slate-950 px-5 py-4 text-sm font-bold leading-7 text-white shadow-raised dark:bg-ma-gold dark:text-slate-950"
                    : "max-w-[86%] rounded-[24px] border border-[#f1ddb0] bg-[#fff6d8] px-5 py-4 text-sm font-semibold leading-7 text-slate-950 shadow-[0_18px_34px_rgba(212,175,55,0.1)] dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
                }
              >
                {message.text}
              </div>
            ))}
            {loading ? (
              <div className="max-w-[72%] rounded-[24px] border border-[#f1ddb0] bg-[#fff6d8] px-5 py-4 text-sm font-semibold leading-6 text-slate-950 shadow-[0_18px_34px_rgba(212,175,55,0.1)] dark:border-white/10 dark:bg-slate-900 dark:text-slate-100">
                <LoadingDots label="Preparing wallet response" />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-black/5 bg-white px-4 py-4 dark:border-white/10 dark:bg-black sm:px-6"
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => submitMessage(prompt)}
                className="btn-secondary !px-3 !py-2 !text-[11px]"
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="rounded-[28px] border border-black/10 bg-[#fffdf9] p-3 shadow-[0_18px_40px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-slate-950">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about wallet balances, token prices, Minima blocks, swaps, sends, or refresh actions..."
              className="min-h-28 w-full resize-none bg-transparent px-2 py-2 text-base font-bold text-slate-950 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
            />
            <div className="mt-3 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="btn-gold justify-center disabled:pointer-events-none disabled:opacity-60"
              >
                {loading ? "Working..." : "Send Command"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </section>
  );
}
