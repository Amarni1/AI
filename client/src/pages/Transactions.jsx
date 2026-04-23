import { useMiniMask } from "../hooks/useMiniMask";
import TransactionHistory from "../components/TransactionHistory";

export default function Transactions() {
  const { address, isAvailable, isChecking, loadCoins } = useMiniMask();

  return (
    <div className="space-y-6">
      <section className="panel-surface p-6">
        <p className="section-kicker">Transaction Safety</p>
        <h2 className="mt-3 font-display text-3xl font-semibold text-slate-900 dark:text-white">
          Confirmation-first workflow
        </h2>
        <div className="mt-6 grid gap-4">
          <div className="surface-muted p-4 text-slate-700 dark:text-slate-200">
            All send requests are reviewed by the backend intent parser first.
          </div>
          <div className="surface-muted p-4 text-slate-700 dark:text-slate-200">
            The backend returns confirmation copy instead of executing transfers.
          </div>
          <div className="surface-muted p-4 text-slate-700 dark:text-slate-200">
            MiniMask is only invoked after a user confirms in the UI.
          </div>
        </div>
      </section>

      <TransactionHistory
        address={address}
        isAvailable={isAvailable}
        isChecking={isChecking}
        loadCoins={loadCoins}
      />
    </div>
  );
}
