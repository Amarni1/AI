export default function ThemeToggle({ isDark, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="group relative inline-flex h-12 w-[92px] items-center rounded-full border border-white/65 bg-[linear-gradient(180deg,#ffffff_0%,#f3f4f6_100%)] px-1 shadow-[0_16px_26px_rgba(15,23,42,0.08),0_7px_0_rgba(203,213,225,0.92)] transition hover:-translate-y-0.5 active:translate-y-[2px] dark:border-white/10 dark:bg-[linear-gradient(180deg,#111827_0%,#020617_100%)] dark:shadow-[0_16px_26px_rgba(0,0,0,0.35),0_7px_0_rgba(15,23,42,0.95)]"
      aria-label="Toggle color theme"
    >
      <span
        className={[
          "absolute h-10 w-10 rounded-full bg-gradient-to-br from-ma-gold via-[#f7df92] to-[#c89619] shadow-[0_10px_18px_rgba(212,175,55,0.35)] transition-transform duration-300",
          isDark ? "translate-x-[42px]" : "translate-x-0"
        ].join(" ")}
      />
      <span className="relative z-10 flex w-full items-center justify-between px-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-700 dark:text-slate-200">
        <span>Day</span>
        <span>Night</span>
      </span>
    </button>
  );
}
