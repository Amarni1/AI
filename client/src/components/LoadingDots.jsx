export default function LoadingDots({ label = "Loading" }) {
  return (
    <div className="inline-flex items-center gap-3 text-sm text-slate-500 dark:text-slate-300">
      <span>{label}</span>
      <span className="flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-full bg-ma-gold animate-bounce [animation-delay:-0.3s]" />
        <span className="h-2.5 w-2.5 rounded-full bg-ma-gold animate-bounce [animation-delay:-0.15s]" />
        <span className="h-2.5 w-2.5 rounded-full bg-ma-gold animate-bounce" />
      </span>
    </div>
  );
}
