import { useEffect, useMemo, useState } from "react";
import StatusPanel from "../components/StatusPanel";
import TransactionHistory from "../components/TransactionHistory";
import WalletCard from "../components/WalletCard";
import { useMiniMask } from "../hooks/useMiniMask";
import { usePortalInsights } from "../hooks/usePortalInsights";
import { useSwapDex } from "../hooks/useSwapDex";
import {
  getOwnedTokenBalances,
  sortBalancesByOwnership
} from "../services/walletPortfolio";

export default function Wallet() {
  const [status, setStatus] = useState("");
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

  async function connectWallet() {
    try {
      await connect();
      setStatus("MiniMask connected.");
    } catch (currentError) {
      setStatus(currentError.message);
    }
  }

  async function refreshWallet() {
    setIsRefreshingAll(true);
    try {
      await Promise.allSettled([
        refresh(),
        insights.refreshAll(),
        dex.refreshAll({ resetUi: true, walletRefreshed: true })
      ]);
      setStatus("Wallet refreshed.");
    } catch (currentError) {
      setStatus(currentError.message);
    } finally {
      setIsRefreshingAll(false);
    }
  }

  useEffect(() => {
    void refreshWallet();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleInstallMiniMask() {
    window.open("https://minimask.org/index.html", "_blank", "noopener,noreferrer");
  }

  return (
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
        onRefresh={refreshWallet}
        tokenBalances={displayedTokenBalances}
      />

      <StatusPanel
        connected={Boolean(address)}
        hasSpendableFunds={ownedTokenBalances.length > 0}
        ownedTokenCount={ownedTokenBalances.length}
        status={status || insights.blockError || insights.priceError || dex.status}
        transactionFlow={dex.transactionFlow}
      />

      <section className="panel-surface p-5 text-sm font-semibold leading-7 text-slate-700 dark:text-slate-200">
        Sendable balances are the only balances the action widget trusts. If MiniMask reports zero
        sendable funds, swap and send actions stay disabled until your wallet can actually sign
        those tokens.
      </section>

      <TransactionHistory
        error={dex.historyError}
        items={dex.history}
        loading={dex.historyLoading}
      />
    </div>
  );
}
