import { Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Wallet from "./pages/Wallet";
import Transactions from "./pages/Transactions";
import Navbar from "./components/Navbar";
import { useTheme } from "./hooks/useTheme";

export default function App() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-halo text-slate-900 dark:text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-ma-gold/18 blur-3xl dark:bg-ma-gold/10" />
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-white/40 blur-3xl dark:bg-slate-700/20" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-amber-200/20 blur-3xl dark:bg-slate-900/40" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[92rem] flex-col px-4 py-6 sm:px-6 lg:px-8">
        <Navbar isDark={isDark} onToggleTheme={toggleTheme} />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/transactions" element={<Transactions />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
