import { startTransition, useEffect, useRef, useState } from "react";
import { api } from "../services/api";
import LoadingDots from "./LoadingDots";

const quickPrompts = [
  "Hello MA",
  "How do I connect my wallet?",
  "Explain Minima like I'm new",
  "How does blockchain security work?",
  "Show me wallet help"
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
    <section className="panel-surface p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-kicker">MA Concierge</p>
          <h2 className="mt-2 font-display text-3xl font-semibold text-slate-900 dark:text-white">
            Conversational wallet intelligence
          </h2>
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
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <div
          ref={chatBodyRef}
          className="h-[28rem] overflow-y-auto rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(255,250,240,0.92))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(15,23,42,0.55))]"
        >
          <div className="space-y-3">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={
                  message.role === "user"
                    ? "ml-auto max-w-[88%] rounded-[22px] bg-slate-950 px-4 py-3 text-sm leading-6 text-white shadow-raised dark:bg-ma-gold dark:text-slate-950"
                    : "max-w-[88%] rounded-[22px] bg-[#fff6d8] px-4 py-3 text-sm leading-6 text-slate-900 shadow-[0_16px_32px_rgba(212,175,55,0.08)] dark:bg-white/8 dark:text-slate-100"
                }
              >
                {message.text}
              </div>
            ))}
            {loading ? (
              <div className="max-w-[72%] rounded-[22px] bg-[#fff6d8] px-4 py-3 text-sm leading-6 text-slate-900 shadow-[0_16px_32px_rgba(212,175,55,0.08)] dark:bg-white/8 dark:text-slate-100">
                <LoadingDots label="MA is thinking" />
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => submitMessage(prompt)}
              className="rounded-full border border-black/10 bg-white/85 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 transition hover:-translate-y-0.5 hover:border-ma-gold hover:text-ma-gold dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
            >
              {prompt}
            </button>
          ))}
        </div>

        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about greetings, wallet help, Minima, blockchain concepts, or secure transfers..."
          className="input-premium min-h-28"
        />
        <button
          type="submit"
          disabled={loading}
          className="btn-gold w-full justify-center disabled:pointer-events-none disabled:opacity-60"
        >
          {loading ? "Sending..." : "Send Command"}
        </button>
      </form>
    </section>
  );
}
