import { startTransition, useEffect, useRef, useState } from "react";
import { api } from "../services/api";
import LoadingDots from "./LoadingDots";

const quickPrompts = [
  "Hello MA",
  "How do I connect my wallet?",
  "Swap 10 minima to usdt",
  "Show token prices",
  "Explain Minima like I'm new",
  "How does blockchain security work?"
];

export default function ChatBox({ onIntent }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatBodyRef = useRef(null);
  const [messages, setMessages] = useState([
    {
      role: "ai",
      text: "Welcome to Minima AI. I can help with wallet actions, Minima education, blockchain concepts, and secure transaction guidance."
    }
  ]);

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
      const result = await api.sendMessage(trimmedMessage);
      startTransition(() => {
        setMessages((current) => [
          ...current,
          { role: "ai", text: result.reply ?? result.message }
        ]);
      });
      onIntent(result);
    } catch (error) {
      startTransition(() => {
        setMessages((current) => [...current, { role: "ai", text: error.message }]);
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
    <section className="panel-surface flex min-h-[calc(100vh-15rem)] flex-col p-0 lg:min-h-[calc(100vh-13rem)]">
      <div className="border-b border-black/5 px-6 py-5 dark:border-white/10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-kicker">MA Concierge</p>
            <h2 className="mt-2 font-display text-3xl font-semibold text-slate-900 dark:text-white">
              Conversational wallet intelligence
            </h2>
            <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">
              Ask naturally about wallets, Minima, blockchain concepts, or secure transfers.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickPrompts.slice(0, 2).map((prompt) => (
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
        className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,250,240,0.96))] px-4 py-6 dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.96),rgba(0,0,0,0.98))] sm:px-6"
      >
        <div className="mx-auto flex h-full w-full max-w-4xl flex-col">
          <div className="mt-auto space-y-4">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={
                  message.role === "user"
                    ? "ml-auto max-w-[88%] rounded-[24px] bg-slate-950 px-5 py-4 text-sm font-semibold leading-7 text-white shadow-raised dark:bg-ma-gold dark:text-slate-950"
                    : "max-w-[88%] rounded-[24px] border border-[#f1ddb0] bg-[#fff6d8] px-5 py-4 text-sm font-medium leading-7 text-slate-900 shadow-[0_18px_34px_rgba(212,175,55,0.1)] dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
                }
              >
                {message.text}
              </div>
            ))}
            {loading ? (
              <div className="max-w-[72%] rounded-[24px] border border-[#f1ddb0] bg-[#fff6d8] px-5 py-4 text-sm font-medium leading-6 text-slate-900 shadow-[0_18px_34px_rgba(212,175,55,0.1)] dark:border-white/10 dark:bg-slate-900 dark:text-slate-100">
                <LoadingDots label="MA is thinking" />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="border-t border-black/5 bg-white px-4 py-4 dark:border-white/10 dark:bg-black sm:px-6">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => submitMessage(prompt)}
                className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-700 transition hover:-translate-y-0.5 hover:border-ma-gold hover:text-ma-gold dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="rounded-[28px] border border-black/10 bg-[#fffdf9] p-3 shadow-[0_18px_40px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-slate-950">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about greetings, wallet help, Minima, blockchain concepts, or secure transfers..."
              className="min-h-28 w-full resize-none bg-transparent px-2 py-2 text-base font-semibold text-slate-950 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
            />
            <div className="mt-3 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="btn-gold justify-center disabled:pointer-events-none disabled:opacity-60"
              >
                {loading ? "Sending..." : "Send Command"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </section>
  );
}
