import { useState } from "react";
import ChatBox from "../components/ChatBox";
import WalletCard from "../components/WalletCard";
import ActionButtons from "../components/ActionButtons";
import ConfirmModal from "../components/ConfirmModal";
import TransactionHistory from "../components/TransactionHistory";
import SendPanel from "../components/SendPanel";
import StatusPanel from "../components/StatusPanel";
import { useMiniMask } from "../hooks/useMiniMask";
import { saveRecentSend } from "../services/transactionHistory";

export default function Dashboard() {
  const [pendingTx, setPendingTx] = useState(null);
  const [status, setStatus] = useState("Ready.");
  const [sendAmount, setSendAmount] = useState("");
  const [sendAddress, setSendAddress] = useState("");
  const [historyRefreshToken, setHistoryRefreshToken] = useState(0);
  const {
    address,
    balance,
    connect,
    error,
    isAvailable,
    isChecking,
    loadCoins,
    refresh,
    send,
    tokenBalances
  } = useMiniMask();

  async function connectWallet() {
    try {
      const nextAddress = await connect();
      setStatus(nextAddress ? "MiniMask connected." : "MiniMask returned no address.");
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function refreshWallet() {
    try {
      await refresh();
      setStatus("Wallet refreshed.");
    } catch (error) {
      setStatus(error.message);
    }
  }

  function handleIntent(result) {
    if (result.intent === "SEND" && result.confirmationRequired) {
      setPendingTx(result.transaction);
      setStatus(result.reply ?? result.message);
      return;
    }

    setStatus(result.reply ?? result.message);
  }

  async function confirmSend() {
    if (!pendingTx) {
      return;
    }

    try {
      const result = await send(pendingTx.amount, pendingTx.address);
      saveRecentSend({
        amount: pendingTx.amount,
        address: pendingTx.address,
        status: "Submitted in MiniMask",
        timestamp: Date.now(),
        id: result?.response?.txpowid || result?.txpowid || `send-${Date.now()}`
      });
      setStatus(`MiniMask response: ${JSON.stringify(result)}`);
      setPendingTx(null);
      setSendAmount("");
      setSendAddress("");
      setHistoryRefreshToken((current) => current + 1);
    } catch (error) {
      setStatus(error.message);
    }
  }

  function handleInstallMiniMask() {
    window.open("https://minima.global/download", "_blank", "noopener,noreferrer");
  }

  function handleSendForm(event) {
    event.preventDefault();
    if (!sendAmount || !sendAddress) {
      setStatus("Enter both amount and wallet address.");
      return;
    }

    setPendingTx({
      amount: Number(sendAmount),
      address: sendAddress
    });
    setStatus(`Please confirm sending ${sendAmount} Minima to ${sendAddress}.`);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
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
        <ChatBox onIntent={handleIntent} />
        <TransactionHistory
          address={address}
          isAvailable={isAvailable}
          isChecking={isChecking}
          loadCoins={loadCoins}
          refreshToken={historyRefreshToken}
        />
      </div>
      <div className="space-y-6">
        <section className="panel-surface p-6">
          <p className="section-kicker">Quick Actions</p>
          <h2 className="mt-2 font-display text-3xl font-semibold text-slate-900 dark:text-white">
            Wallet shortcuts
          </h2>
          <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
            Refresh balances, reconnect the active wallet, and keep the assistant aligned with the latest state.
          </p>
          <div className="mt-5">
            <ActionButtons
              onBalance={refreshWallet}
              onAddress={connectWallet}
            />
          </div>
        </section>

        <SendPanel
          connected={Boolean(address)}
          sendAddress={sendAddress}
          sendAmount={sendAmount}
          setSendAddress={setSendAddress}
          setSendAmount={setSendAmount}
          onSubmit={handleSendForm}
        />

        <StatusPanel
          connected={Boolean(address)}
          status={error && !isAvailable ? error : status}
          tokenCount={tokenBalances.length}
        />
      </div>

      <ConfirmModal
        open={Boolean(pendingTx)}
        message={
          pendingTx
            ? `Confirm sending ${pendingTx.amount} Minima to ${pendingTx.address}`
            : ""
        }
        onConfirm={confirmSend}
        onCancel={() => setPendingTx(null)}
      />
    </div>
  );
}
