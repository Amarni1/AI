import { useEffect, useMemo, useState } from "react";
import ChatBox from "../components/ChatBox";
import ConfirmModal from "../components/ConfirmModal";
import ExchangeModal from "../components/ExchangeModal";
import StatusPanel from "../components/StatusPanel";
import TransactionHistory from "../components/TransactionHistory";
import WalletCard from "../components/WalletCard";
import { useMiniMask } from "../hooks/useMiniMask";
import { usePortalInsights } from "../hooks/usePortalInsights";
import { useSwapDex } from "../hooks/useSwapDex";
import { getTokenId } from "../services/swapEngine";
import {
  getOwnedTokenBalances,
  sortBalancesByOwnership
} from "../services/walletPortfolio";

export default function Dashboard({ exchangeLaunchRequest = 0 }) {
  const [widgetMode, setWidgetMode] = useState("exchange");
  const [exchangeOpen, setExchangeOpen] = useState(false);
  const [aiSendConfirmation, setAiSendConfirmation] = useState(null);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const {
    address,
    balance,
    connect,
    error,
    isAvailable,
    isChecking,
    isSyncing,
    refresh,
    send,
    sendableBalances,
    tokenBalances
  } = useMiniMask();
  const insights = usePortalInsights({ isMiniMaskAvailable: isAvailable });
  const dex = useSwapDex({
    address,
    marketPrices: insights.prices,
    refreshWallet: refresh,
    send,
    sendableBalances
  });

  const displayedTokenBalances = useMemo(
    () => sortBalancesByOwnership(sendableBalances.length ? sendableBalances : tokenBalances),
    [sendableBalances, tokenBalances]
  );
  const ownedTokenBalances = useMemo(
    () => getOwnedTokenBalances(sendableBalances),
    [sendableBalances]
  );
  const hasSpendableFunds = ownedTokenBalances.length > 0;
  const aiSendConfirmationDetails = useMemo(() => {
    if (!aiSendConfirmation) {
      return [];
    }

    return [
      {
        label: "Amount",
        value: `${aiSendConfirmation.amount} ${aiSendConfirmation.token}`
      },
      {
        label: "Recipient",
        value: aiSendConfirmation.address
      },
      {
        label: "Token ID",
        value: aiSendConfirmation.tokenId
      }
    ];
  }, [aiSendConfirmation]);

  async function connectWallet() {
    try {
      await connect();
    } catch {
      // Wallet hook already surfaces the error in UI state.
    }
  }

  async function refreshEverything() {
    setIsRefreshingAll(true);
    try {
      await Promise.allSettled([
        refresh(),
        insights.refreshAll(),
        dex.refreshAll({ resetUi: true, walletRefreshed: true })
      ]);
      setWidgetMode("exchange");
    } catch {
      // Individual hooks already surface their own errors.
    } finally {
      setIsRefreshingAll(false);
    }
  }

  function handleIntent(result) {
    if (result.openMode) {
      setWidgetMode(result.openMode);
      setExchangeOpen(true);
    }

    if (result.requestRefresh) {
      void refreshEverything();
    }

    if (result.swapQuote) {
      setWidgetMode("swap");
      setExchangeOpen(true);
      dex.applyAiQuote(result.swapQuote);
    }

    if (result.sendDraft) {
      setWidgetMode("exchange");
      dex.applyAiSend(result.sendDraft);
      setAiSendConfirmation({
        address: result.sendDraft.address,
        amount: String(result.sendDraft.amount ?? "0"),
        token: result.sendDraft.token || "MINIMA",
        tokenId: getTokenId(result.sendDraft.token || "MINIMA") || "0x00"
      });
    }
  }

  async function handleConfirmAiSend() {
    if (!aiSendConfirmation) {
      return;
    }

    const nextTransaction = aiSendConfirmation;
    setAiSendConfirmation(null);

    try {
      await dex.executeSend(nextTransaction);
    } catch {
      // The shared send engine already exposes the failure state.
    }
  }

  function handleCancelAiSend() {
    setAiSendConfirmation(null);
  }

  function handleInstallMiniMask() {
    window.open("https://minimask.org/index.html", "_blank", "noopener,noreferrer");
  }

  function openExchange(mode = "exchange") {
    setWidgetMode(mode);
    setExchangeOpen(true);
  }

  useEffect(() => {
    if (!exchangeLaunchRequest) {
      return;
    }

    openExchange("exchange");
  }, [exchangeLaunchRequest]);

  return (
    <>
      <div className="space-y-6">
        <section className="panel-surface overflow-hidden p-6">
          <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.16),transparent_60%)]" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <p className="section-kicker">Minima Finance Portal</p>
              <h2 className="mt-3 font-display text-4xl font-semibold text-slate-900 dark:text-white sm:text-5xl">
                Secure wallet access, token exchange, live balances, and blockchain settlement tools powered by MiniMask.
              </h2>
              <p className="mt-4 text-sm font-semibold leading-7 text-slate-700 dark:text-slate-200">
                Manage assets, execute swaps, monitor balances, and interact directly with the Minima network using live prices, live block data, and confirmation-aware wallet flows.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[24px] border border-[#ecd79a] bg-[#fff7dd] px-5 py-4 text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-white">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-ma-gold">Owned</p>
                <p className="mt-3 text-3xl font-extrabold">{ownedTokenBalances.length}</p>
              </div>
              <div className="rounded-[24px] border border-[#ecd79a] bg-[#fff7dd] px-5 py-4 text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-white">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-ma-gold">MINIMA</p>
                <p className="mt-3 text-xl font-extrabold">{insights.priceCards[0]?.value}</p>
              </div>
              <div className="rounded-[24px] border border-[#ecd79a] bg-[#fff7dd] px-5 py-4 text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-white">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-ma-gold">USDT</p>
                <p className="mt-3 text-xl font-extrabold">{insights.priceCards[1]?.value}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_420px]">
          <div className="space-y-6">
            <ChatBox
              onIntent={handleIntent}
              walletContext={{
                blockNumber: insights.blockNumber,
                prices: insights.prices,
                sendableBalances,
                walletAddress: address
              }}
            />

            <TransactionHistory
              error={dex.historyError}
              items={dex.history}
              loading={dex.historyLoading}
            />
          </div>

          <div className="space-y-6">
            <WalletCard
              address={address}
              balance={balance}
              connected={Boolean(address)}
              error={error}
              isAvailable={isAvailable}
              isChecking={isChecking}
              isSyncing={isSyncing || isRefreshingAll}
              onConnect={connectWallet}
              onInstall={handleInstallMiniMask}
              onRefresh={refreshEverything}
              tokenBalances={displayedTokenBalances}
            />

            <StatusPanel
              connected={Boolean(address)}
              hasSpendableFunds={hasSpendableFunds}
              ownedTokenCount={ownedTokenBalances.length}
              status={
                error && !isAvailable
                  ? error
                  : insights.blockError || insights.priceError || dex.status
              }
              transactionFlow={dex.transactionFlow}
            />
          </div>
        </div>
      </div>

      <ExchangeModal
        availableTokens={dex.availableTokens}
        blockLoading={insights.blockLoading}
        blockNumber={insights.blockNumber}
        connected={Boolean(address)}
        form={dex.form}
        marketPrices={insights.prices}
        mode={widgetMode}
        onClose={() => setExchangeOpen(false)}
        onExecuteExchange={dex.executeSend}
        onExecuteSwap={dex.executeSwap}
        onFlip={dex.flipTokens}
        onModeChange={setWidgetMode}
        onSetField={dex.setField}
        onSetSendField={dex.setSendField}
        open={exchangeOpen}
        previewQuote={dex.previewQuote}
        quote={dex.activeQuote}
        quoteLoading={dex.quoteLoading}
        sendDisabledReason={dex.sendDisabledReason}
        sendForm={dex.sendForm}
        sendLoading={dex.sendLoading}
        sendSourceBalance={dex.sendSourceBalance}
        sourceBalance={dex.sourceBalance}
        swapDisabledReason={dex.swapDisabledReason}
        swapLoading={dex.swapLoading}
        tokenBalances={displayedTokenBalances}
        walletAddress={address}
        walletLoading={isChecking || isSyncing}
        zeroBalanceWarning={dex.zeroBalanceWarning}
      />

      <ConfirmModal
        confirmLabel="Confirm"
        description="Review this MiniMask transaction before signing."
        details={aiSendConfirmationDetails}
        message="MiniMask will open after you confirm this transaction."
        onCancel={handleCancelAiSend}
        onConfirm={handleConfirmAiSend}
        open={Boolean(aiSendConfirmation)}
        title="Confirm Transaction"
      />
    </>
  );
}
