import ChatBox from "../components/ChatBox";
import ReservePanel from "../components/ReservePanel";
import StatusPanel from "../components/StatusPanel";
import SwapCard from "../components/SwapCard";
import TransactionHistory from "../components/TransactionHistory";
import WalletCard from "../components/WalletCard";
import { useMiniMask } from "../hooks/useMiniMask";
import { useSwapDex } from "../hooks/useSwapDex";

export default function Dashboard() {
  const {
    address,
    balance,
    connect,
    error,
    isAvailable,
    isChecking,
    refresh,
    send,
    sendableBalances,
    tokenBalances
  } = useMiniMask();
  const dex = useSwapDex({
    address,
    refreshWallet: refresh,
    send
  });

  async function connectWallet() {
    await connect();
  }

  async function refreshWallets() {
    await dex.refreshAll();
  }

  function handleIntent(result) {
    if (result.swapQuote) {
      dex.applyAiQuote(result.swapQuote);
    }
  }

  function handleInstallMiniMask() {
    window.open("https://minimask.org/index.html", "_blank", "noopener,noreferrer");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_430px]">
      <div className="space-y-6">
        <section className="panel-surface overflow-hidden p-6">
          <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.18),transparent_60%)]" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="section-kicker">Minima AI Swap DEX</p>
              <h2 className="mt-3 font-display text-4xl font-semibold text-slate-900 dark:text-white sm:text-5xl">
                Direct on-chain swap requests, signed in MiniMask and tracked to confirmation
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-700 dark:text-slate-200">
                Each request is prepared locally, signed in MiniMask, written to the Minima
                chain, and tracked client-side until the txpow confirms. No orderbook,
                payout service, or swap API sits in the live execution path.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[24px] border border-[#ecd79a] bg-[#fff7dd] px-5 py-4 text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-white">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-ma-gold">Tokens</p>
                <p className="mt-3 text-3xl font-extrabold">{dex.availableTokens.length}</p>
              </div>
              <div className="rounded-[24px] border border-[#ecd79a] bg-[#fff7dd] px-5 py-4 text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-white">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-ma-gold">Mode</p>
                <p className="mt-3 text-xl font-extrabold">
                  Direct
                </p>
              </div>
              <div className="rounded-[24px] border border-[#ecd79a] bg-[#fff7dd] px-5 py-4 text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-white">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-ma-gold">Swaps</p>
                <p className="mt-3 text-3xl font-extrabold">{dex.history.length}</p>
              </div>
            </div>
          </div>
        </section>

        <SwapCard
          availableTokens={dex.availableTokens}
          connected={Boolean(address)}
          form={dex.form}
          onExecute={dex.executeSwap}
          onFlip={dex.flipTokens}
          onSetField={dex.setField}
          previewQuote={dex.previewQuote}
          quote={dex.activeQuote}
          quoteLoading={dex.quoteLoading}
          routeAddress={dex.config.recipientAddress}
          swapLoading={dex.swapLoading}
        />

        <ChatBox onIntent={handleIntent} />
      </div>

      <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
        <WalletCard
          address={address}
          balance={balance}
          error={error}
          isAvailable={isAvailable}
          isChecking={isChecking}
          onConnect={connectWallet}
          onInstall={handleInstallMiniMask}
          onRefresh={refreshWallets}
          connected={Boolean(address)}
          tokenBalances={sendableBalances.length ? sendableBalances : tokenBalances}
        />

        <ReservePanel config={dex.config} />

        <StatusPanel
          connected={Boolean(address)}
          status={error && !isAvailable ? error : dex.status}
          tokenCount={sendableBalances.length}
          transactionFlow={dex.transactionFlow}
        />

        <TransactionHistory
          error={dex.historyError}
          items={dex.history}
          loading={dex.historyLoading}
        />
      </div>
    </div>
  );
}
