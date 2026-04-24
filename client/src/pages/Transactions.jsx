import StatusPanel from "../components/StatusPanel";
import TransactionHistory from "../components/TransactionHistory";
import { useMiniMask } from "../hooks/useMiniMask";
import { useSwapDex } from "../hooks/useSwapDex";

export default function Transactions() {
  const { address, refresh, send, sendableBalances } = useMiniMask();
  const dex = useSwapDex({
    address,
    refreshWallet: refresh,
    send
  });

  return (
    <div className="space-y-6">
      <section className="panel-surface p-6">
        <p className="section-kicker">Confirmation Flow</p>
        <h2 className="mt-3 font-display text-3xl font-semibold text-slate-900 dark:text-white">
          Direct on-chain verification workflow
        </h2>
        <div className="mt-6 grid gap-4">
          <div className="surface-muted p-4 text-slate-700 dark:text-slate-200">
            Every swap request is signed locally in MiniMask and submitted from your browser.
          </div>
          <div className="surface-muted p-4 text-slate-700 dark:text-slate-200">
            The app polls the Minima chain with `checktxpow` until the tx confirms or times out.
          </div>
          <div className="surface-muted p-4 text-slate-700 dark:text-slate-200">
            Quote metadata is recorded on-chain in state variables, so the request can be reviewed without any backend service.
          </div>
        </div>
      </section>

      <StatusPanel
        connected={Boolean(address)}
        status={dex.status}
        tokenCount={sendableBalances.length}
        transactionFlow={dex.transactionFlow}
      />

      <TransactionHistory
        error={dex.historyError}
        items={dex.history}
        loading={dex.historyLoading}
      />
    </div>
  );
}
