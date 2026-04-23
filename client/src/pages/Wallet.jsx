import { useEffect, useState } from "react";
import TransactionHistory from "../components/TransactionHistory";
import WalletCard from "../components/WalletCard";
import { useMiniMask } from "../hooks/useMiniMask";

export default function Wallet() {
  const [status, setStatus] = useState("");
  const {
    address,
    balance,
    connect,
    error,
    isAvailable,
    isChecking,
    loadCoins,
    refresh,
    tokenBalances
  } = useMiniMask();

  async function connectWallet() {
    try {
      await connect();
      setStatus("MiniMask connected.");
    } catch (currentError) {
      setStatus(currentError.message);
    }
  }

  async function refreshWallet() {
    try {
      await refresh();
      setStatus("Wallet refreshed.");
    } catch (currentError) {
      setStatus(currentError.message);
    }
  }

  useEffect(() => {
    refreshWallet();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleInstallMiniMask() {
    window.open("https://minima.global/download", "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-6">
      <WalletCard
        address={address}
        balance={balance}
        error={error}
        isAvailable={isAvailable}
        isChecking={isChecking}
        onConnect={connectWallet}
        onInstall={handleInstallMiniMask}
        onRefresh={refreshWallet}
        connected={Boolean(address)}
        tokenBalances={tokenBalances}
      />
      {status ? (
        <section className="panel-surface p-6 text-sm text-slate-700 dark:text-slate-200">
          {status}
        </section>
      ) : null}
      <TransactionHistory
        address={address}
        isAvailable={isAvailable}
        isChecking={isChecking}
        loadCoins={loadCoins}
      />
    </div>
  );
}
