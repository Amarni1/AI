import { useEffect, useRef, useState } from "react";
import ChatBox from "../components/ChatBox";
import WalletCard from "../components/WalletCard";
import ActionButtons from "../components/ActionButtons";
import ConfirmModal from "../components/ConfirmModal";
import TransactionHistory from "../components/TransactionHistory";
import SendPanel from "../components/SendPanel";
import StatusPanel from "../components/StatusPanel";
import ExchangeHero from "../components/ExchangeHero";
import ExchangeModal from "../components/ExchangeModal";
import { useMiniMask } from "../hooks/useMiniMask";
import { MiniMask } from "../services/minimask";
import { updateRecentSend, saveRecentSend } from "../services/transactionHistory";
import {
  buildSwapFlow,
  buildTransactionFlow,
  extractTxPowId,
  isTxConfirmed,
  TX_CONFIRMATION_TIMEOUT_MS,
  TX_POLL_INTERVAL_MS
} from "../services/transactionStatus";

export default function Dashboard() {
  const exchangeAddress = import.meta.env.VITE_EXCHANGE_ADDRESS ?? "";
  const [pendingTx, setPendingTx] = useState(null);
  const [pendingSwap, setPendingSwap] = useState(null);
  const [isExchangeOpen, setIsExchangeOpen] = useState(false);
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

    if (result.swapQuote) {
      setPendingSwap(result.swapQuote);
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

  async function monitorSwapConfirmation(txpowid, quote) {
    const pollToken = ++activePollRef.current;

    await new Promise((resolve) => window.setTimeout(resolve, 1200));
    if (pollToken !== activePollRef.current) {
      return;
    }

    const processingFlow = buildSwapFlow("processing", quote, txpowid);
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
          const successFlow = buildSwapFlow("success", quote, txpowid);
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

    const timeoutFlow = buildSwapFlow("timeout", quote, txpowid);
    setTransactionFlow(timeoutFlow);
    setStatus(timeoutFlow.detail);
    updateRecentSend(txpowid, {
      status: timeoutFlow.badge,
      detail: timeoutFlow.detail
    });
    setHistoryRefreshToken((current) => current + 1);
  }

  async function confirmSwap() {
    if (!pendingSwap) {
      return;
    }

    const quote = pendingSwap;

    if (!exchangeAddress) {
      setPendingSwap(null);
      setStatus("Swap quote is ready. Add VITE_EXCHANGE_ADDRESS to execute live swaps through MiniMask.");
      return;
    }

    if (quote.fromToken !== "MINIMA") {
      setPendingSwap(null);
      setStatus("Live execution is currently enabled for MINIMA swap routes. Add token IDs for other assets to enable direct routing.");
      return;
    }

    try {
      const result = await send(quote.amount, exchangeAddress, {
        state: {
          0: String(quote.amount),
          1: quote.fromToken,
          2: quote.toToken,
          3: quote.receiveAmount,
          4: "swap-quote"
        }
      });
      const txpowid = extractTxPowId(result);
      const submittedFlow = buildSwapFlow("submitted", quote, txpowid);

      saveRecentSend({
        amount: quote.amount,
        asset: quote.fromToken,
        address: `${quote.fromToken} -> ${quote.toToken}`,
        status: submittedFlow.badge,
        detail: `${quote.receiveAmount} ${quote.toToken} quoted through exchange route.`,
        timestamp: Date.now(),
        id: txpowid || `swap-${Date.now()}`,
        txpowid: txpowid || ""
      });

      setTransactionFlow(submittedFlow);
      setStatus(submittedFlow.detail);
      setPendingSwap(null);
      setHistoryRefreshToken((current) => current + 1);

      if (txpowid) {
        monitorSwapConfirmation(txpowid, quote);
      } else {
        setStatus("Swap submitted, but MiniMask did not return a txpowid for confirmation tracking.");
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

  function handleOpenExchange() {
    setIsExchangeOpen(true);
  }

  function handleCloseExchange() {
    setIsExchangeOpen(false);
  }

  function handleSwapQuote(quote) {
    setPendingSwap(quote);
    setIsExchangeOpen(false);
    setStatus(`${quote.amount} ${quote.fromToken} = ${quote.receiveAmount} ${quote.toToken}. Proceed with swap?`);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_420px]">
      <div className="space-y-6">
        <ExchangeHero onOpen={handleOpenExchange} />
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
        open={Boolean(pendingTx || pendingSwap)}
        message={
          pendingSwap
            ? `Confirm swapping ${pendingSwap.amount} ${pendingSwap.fromToken} for approximately ${pendingSwap.receiveAmount} ${pendingSwap.toToken}?`
            : pendingTx
              ? `Confirm sending ${pendingTx.amount} Minima to ${pendingTx.address}`
              : ""
        }
        onConfirm={pendingSwap ? confirmSwap : confirmSend}
        onCancel={() => {
          setPendingTx(null);
          setPendingSwap(null);
        }}
      />

      <ExchangeModal
        open={isExchangeOpen}
        onClose={handleCloseExchange}
        onQuote={handleSwapQuote}
      />
    </div>
  );
}
