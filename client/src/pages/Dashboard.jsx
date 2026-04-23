import { useEffect, useRef, useState } from "react";
import ChatBox from "../components/ChatBox";
import WalletCard from "../components/WalletCard";
import ActionButtons from "../components/ActionButtons";
import ConfirmModal from "../components/ConfirmModal";
import TransactionHistory from "../components/TransactionHistory";
import SendPanel from "../components/SendPanel";
import StatusPanel from "../components/StatusPanel";
import { useMiniMask } from "../hooks/useMiniMask";
import { MiniMask } from "../services/minimask";
import { updateRecentSend, saveRecentSend } from "../services/transactionHistory";
import {
  buildTransactionFlow,
  extractTxPowId,
  isTxConfirmed,
  TX_CONFIRMATION_TIMEOUT_MS,
  TX_POLL_INTERVAL_MS
} from "../services/transactionStatus";

export default function Dashboard() {
  const [pendingTx, setPendingTx] = useState(null);
  const [status, setStatus] = useState("Ready.");
  const [sendAmount, setSendAmount] = useState("");
  const [sendAddress, setSendAddress] = useState("");
  const [historyRefreshToken, setHistoryRefreshToken] = useState(0);
  const [transactionFlow, setTransactionFlow] = useState(null);
  const activePollRef = useRef(0);
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

  useEffect(() => {
    return () => {
      activePollRef.current += 1;
    };
  }, []);

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
      setHistoryRefreshToken((current) => current + 1);
      setStatus("Dashboard refreshed.");
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

  async function monitorTransactionConfirmation(txpowid, transaction) {
    const pollToken = ++activePollRef.current;

    await new Promise((resolve) => window.setTimeout(resolve, 1200));
    if (pollToken !== activePollRef.current) {
      return;
    }

    const processingFlow = buildTransactionFlow("processing", transaction, txpowid);
    setTransactionFlow(processingFlow);
    setStatus(processingFlow.detail);
    updateRecentSend(txpowid, {
      status: processingFlow.badge,
      detail: processingFlow.detail
    });
    setHistoryRefreshToken((current) => current + 1);

    const startedAt = Date.now();

    while (Date.now() - startedAt < TX_CONFIRMATION_TIMEOUT_MS) {
      if (pollToken !== activePollRef.current) {
        return;
      }

      try {
        const response = await MiniMask.checkTxPowAsync(txpowid);

        if (isTxConfirmed(response)) {
          const successFlow = buildTransactionFlow("success", transaction, txpowid);
          setTransactionFlow(successFlow);
          setStatus(successFlow.detail);
          updateRecentSend(txpowid, {
            status: successFlow.badge,
            detail: successFlow.detail
          });
          setHistoryRefreshToken((current) => current + 1);
          await refresh();
          return;
        }
      } catch (error) {
        setStatus(error.message);
      }

      await new Promise((resolve) => window.setTimeout(resolve, TX_POLL_INTERVAL_MS));
    }

    if (pollToken !== activePollRef.current) {
      return;
    }

    const timeoutFlow = buildTransactionFlow("timeout", transaction, txpowid);
    setTransactionFlow(timeoutFlow);
    setStatus(timeoutFlow.detail);
    updateRecentSend(txpowid, {
      status: timeoutFlow.badge,
      detail: timeoutFlow.detail
    });
    setHistoryRefreshToken((current) => current + 1);
  }

  async function confirmSend() {
    if (!pendingTx) {
      return;
    }

    try {
      const transaction = pendingTx;
      const result = await send(transaction.amount, transaction.address);
      const txpowid = extractTxPowId(result);
      const submittedFlow = buildTransactionFlow("submitted", transaction, txpowid);

      saveRecentSend({
        amount: transaction.amount,
        address: transaction.address,
        status: submittedFlow.badge,
        detail: submittedFlow.detail,
        timestamp: Date.now(),
        id: txpowid || `send-${Date.now()}`,
        txpowid: txpowid || ""
      });
      setTransactionFlow(submittedFlow);
      setStatus(submittedFlow.detail);
      setPendingTx(null);
      setSendAmount("");
      setSendAddress("");
      setHistoryRefreshToken((current) => current + 1);
      if (txpowid) {
        monitorTransactionConfirmation(txpowid, transaction);
      } else {
        setStatus("Transaction submitted, but MiniMask did not return a txpowid for confirmation tracking.");
      }
    } catch (error) {
      setStatus(error.message);
    }
  }

  function handleInstallMiniMask() {
    window.open("https://minimask.org/index.html", "_blank", "noopener,noreferrer");
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
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_420px]">
      <div className="space-y-6">
        <ChatBox onIntent={handleIntent} />
        <TransactionHistory
          address={address}
          isAvailable={isAvailable}
          isChecking={isChecking}
          loadCoins={loadCoins}
          refreshToken={historyRefreshToken}
        />
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
          onRefresh={refreshWallet}
          connected={Boolean(address)}
          tokenBalances={tokenBalances}
        />
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
              onAddress={refreshWallet}
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
          transactionFlow={transactionFlow}
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
