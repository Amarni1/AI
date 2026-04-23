const settings = [
  { label: "Frontend", value: "Vite + React + Tailwind + Framer Motion" },
  { label: "API", value: "Express + Zod + Helmet" },
  { label: "Policy", value: "No auto-send, explicit confirmation required" }
];

export default function Settings() {
  return (
    <section className="panel-surface p-6">
      <p className="section-kicker">Architecture Settings</p>
      <h2 className="mt-3 font-display text-3xl font-semibold text-slate-900 dark:text-white">
        Premium dashboard configuration
      </h2>
      <div className="mt-6 grid gap-4">
        {settings.map((item) => (
          <div
            key={item.label}
            className="surface-muted p-4"
          >
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">{item.label}</p>
            <p className="mt-2 text-slate-800 dark:text-slate-100">{item.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
