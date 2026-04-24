import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MiniMask } from "../services/minimask";
import {
  buildTransactionFlow,
  TX_CONFIRMATION_TIMEOUT_MS,
  TX_POLL_INTERVAL_MS,
  buildSwapFlow,
  extractTxPowId,
  isTxConfirmed
} from "../services/transactionStatus";
import {
  DEFAULT_SIGNAL_AMOUNT,
  TOKEN_OPTIONS,
  buildDirectModeConfig,
  buildDirectSwapQuote,
  getTokenId
} from "../services/swapEngine";
import {
  formatDisplayedAmount,
  getOwnedTokenBalances,
  getTokenSendableBalance,
  prioritizeOwnedTokens
} from "../services/walletPortfolio";

const DEFAULT_STATUS_MESSAGE = "Connect MiniMask to activate the wallet action widget.";
const ZERO_BALANCE_WARNING =
  "Wallet balance is 0. Only zero-value transactions are allowed.";

let cachedSwapSession = {
  history: [],
  historyError: "",
  quote: null,
  status: DEFAULT_STATUS_MESSAGE,
  transactionFlow: null
};

function updateCachedSwapSession(patch) {
  cachedSwapSession = {
    ...cachedSwapSession,
    ...patch
  };
}

function mergeHistoryRecord(current, nextRecord) {
  const nextId = nextRecord.id || nextRecord.txpowid || `activity-${Date.now()}`;

  return [
    { ...nextRecord, id: nextId },
    ...current.filter((item) => (item.id || item.txpowid) !== nextId)
  ].slice(0, 24);
}

function updateHistoryRecord(current, recordId, patch) {
  return current.map((item) =>
    item.id === recordId || item.txpowid === recordId
      ? {
          ...item,
          ...patch,
          updatedAt: Date.now()
        }
      : item
  );
}

function getSwapDisabledReason({ address, amount, fromToken, previewQuote, sourceBalance }) {
  if (!address) {
    return "Connect MiniMask to swap.";
  }

  if (String(amount ?? "").trim() === "") {
    return "Enter a valid swap amount.";
  }

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount < 0) {
    return "Enter a valid swap amount.";
  }

  if (!previewQuote) {
    return "Choose two different tokens to quote the swap.";
  }

  if (sourceBalance <= 0 && numericAmount > 0) {
    return ZERO_BALANCE_WARNING;
  }

  if (numericAmount > sourceBalance) {
    return `Only ${formatDisplayedAmount(sourceBalance)} ${fromToken} is sendable.`;
  }

  return "";
}

function getSendDisabledReason({ address, amount, recipientAddress, sourceBalance, token }) {
  if (!address) {
    return "Connect MiniMask to send funds.";
  }

  if (!recipientAddress.trim()) {
    return "Enter a recipient address.";
  }

  if (String(amount ?? "").trim() === "") {
    return "Enter a valid send amount.";
  }

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount < 0) {
    return "Enter a valid send amount.";
  }

  if (sourceBalance <= 0 && numericAmount > 0) {
    return ZERO_BALANCE_WARNING;
  }

  if (numericAmount > sourceBalance) {
    return `Only ${formatDisplayedAmount(sourceBalance)} ${token} is sendable.`;
  }

  return "";
}

function normalizeSendTransaction(input, fallbackToken = "MINIMA") {
  return {
    address: String(input?.address || "").trim(),
    amount: String(input?.amount ?? ""),
    token: input?.token || fallbackToken
  };
}

function buildFlow(type, phase, payload, txpowid = "") {
  return type === "send"
    ? buildTransactionFlow(phase, payload, txpowid)
    : buildSwapFlow(phase, payload, txpowid);
}

function buildHistoryPatch(type, phase, errorMessage = "") {
  if (type === "send") {
    if (phase === "submitted") {
      return {
        status: "submitted",
        statusDetail: "Submitted to MiniMask and broadcast to the network."
      };
    }

    if (phase === "processing") {
      return {
        status: "processing",
        statusDetail: "Waiting for on-chain confirmation."
      };
    }

    if (phase === "success") {
      return {
        status: "success",
        statusDetail: "Confirmed on network."
      };
    }

    if (phase === "timeout") {
      return {
        status: "timeout",
        statusDetail: "Still waiting for on-chain confirmation."
      };
    }

    return {
      status: "failed",
      statusDetail: errorMessage || "MiniMask could not submit the wallet send."
    };
  }

  if (phase === "submitted") {
    return {
      status: "submitted",
      statusDetail: "Submitted to MiniMask and broadcast to the network."
    };
  }

  if (phase === "processing") {
    return {
      status: "processing",
      statusDetail: "Waiting for on-chain confirmation."
    };
  }

  if (phase === "success") {
    return {
      status: "success",
      statusDetail: "Confirmed on network."
    };
  }

  if (phase === "timeout") {
    return {
      status: "timeout",
      statusDetail: "Still waiting for on-chain confirmation."
    };
  }

  return {
    status: "failed",
    statusDetail: errorMessage || "MiniMask could not submit the swap request."
  };
}

export function useSwapDex({
  address,
  marketPrices = {},
  refreshWallet,
  send,
  sendableBalances = []
}) {
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [swapLoading, setSwapLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(cachedSwapSession.historyError);
  const [status, setStatus] = useState(cachedSwapSession.status);
  const [quote, setQuote] = useState(cachedSwapSession.quote);
  const [history, setHistory] = useState(cachedSwapSession.history);
  const [transactionFlow, setTransactionFlow] = useState(cachedSwapSession.transactionFlow);
  const [form, setForm] = useState({
    amount: "10",
    fromToken: "MINIMA",
    toToken: "USDT"
  });
  const [sendForm, setSendForm] = useState({
    address: "",
    amount: "",
    token: "MINIMA"
  });

  const pollTimerRef = useRef(null);

  const config = useMemo(
    () => buildDirectModeConfig(address, marketPrices),
    [address, marketPrices]
  );
  const availableTokens = useMemo(
    () => prioritizeOwnedTokens(TOKEN_OPTIONS, sendableBalances),
    [sendableBalances]
  );
  const ownedTokenBalances = useMemo(
    () => getOwnedTokenBalances(sendableBalances),
    [sendableBalances]
  );
  const previewQuote = useMemo(
    () => buildDirectSwapQuote(form.amount, form.fromToken, form.toToken, address, marketPrices),
    [address, form.amount, form.fromToken, form.toToken, marketPrices]
  );
  const sourceBalance = useMemo(
    () => getTokenSendableBalance(sendableBalances, form.fromToken),
    [form.fromToken, sendableBalances]
  );
  const sendSourceBalance = useMemo(
    () => getTokenSendableBalance(sendableBalances, sendForm.token),
    [sendForm.token, sendableBalances]
  );
  const swapDisabledReason = useMemo(
    () =>
      getSwapDisabledReason({
        address,
        amount: form.amount,
        fromToken: form.fromToken,
        previewQuote,
        sourceBalance
      }),
    [address, form.amount, form.fromToken, previewQuote, sourceBalance]
  );
  const sendDisabledReason = useMemo(
    () =>
      getSendDisabledReason({
        address,
        amount: sendForm.amount,
        recipientAddress: sendForm.address,
        sourceBalance: sendSourceBalance,
        token: sendForm.token
      }),
    [address, sendForm.address, sendForm.amount, sendForm.token, sendSourceBalance]
  );

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const beginPolling = useCallback((recordId, type, payload, txpowid) => {
    stopPolling();
    const startedAt = Date.now();

    setTransactionFlow(buildFlow(type, "processing", payload, txpowid));
    setHistory((current) =>
      updateHistoryRecord(current, recordId, {
        ...buildHistoryPatch(type, "processing"),
        txpowid
      })
    );
    setStatus("Processing on-chain confirmation.");

    pollTimerRef.current = window.setInterval(async () => {
      try {
        if (Date.now() - startedAt >= TX_CONFIRMATION_TIMEOUT_MS) {
          stopPolling();
          setTransactionFlow(buildFlow(type, "timeout", payload, txpowid));
          setHistory((current) =>
            updateHistoryRecord(current, recordId, {
              ...buildHistoryPatch(type, "timeout"),
              txpowid
            })
          );
          setStatus("Timed out waiting for chain confirmation.");
          return;
        }

        const result = await MiniMask.checkTxPowAsync(txpowid);
        if (!isTxConfirmed(result)) {
          return;
        }

        stopPolling();
        setTransactionFlow(buildFlow(type, "success", payload, txpowid));
        setHistory((current) =>
          updateHistoryRecord(current, recordId, {
            ...buildHistoryPatch(type, "success"),
            txpowid
          })
        );
        setStatus(type === "send"
          ? "Wallet send confirmed on network."
          : "Direct on-chain swap request confirmed on network.");
        await Promise.allSettled([refreshWallet ? refreshWallet() : Promise.resolve()]);
      } catch (error) {
        stopPolling();
        setTransactionFlow(buildFlow(type, "failed", payload, txpowid));
        setHistory((current) =>
          updateHistoryRecord(current, recordId, {
            ...buildHistoryPatch(type, "failed", error.message),
            txpowid
          })
        );
        setStatus(error.message || "Unable to verify transaction confirmation.");
      }
    }, TX_POLL_INTERVAL_MS);
  }, [refreshWallet, stopPolling]);

  const requestQuote = useCallback(async (override = {}) => {
    setQuoteLoading(true);

    try {
      const nextQuote = buildDirectSwapQuote(
        override.amount ?? form.amount,
        override.fromToken ?? form.fromToken,
        override.toToken ?? form.toToken,
        address,
        marketPrices
      );

      if (!nextQuote) {
        throw new Error("Choose two different tokens and enter a valid amount.");
      }

      setQuote(nextQuote);
      setStatus("Quote ready. Review the widget and sign in MiniMask when ready.");
      return nextQuote;
    } catch (error) {
      setStatus(error.message || "Unable to prepare the swap quote.");
      throw error;
    } finally {
      setQuoteLoading(false);
    }
  }, [address, form.amount, form.fromToken, form.toToken, marketPrices]);

  const executeSwap = useCallback(async () => {
    const preparedQuote = quote || previewQuote;
    setSwapLoading(true);
    setHistoryError("");

    try {
      if (swapDisabledReason) {
        throw new Error(swapDisabledReason);
      }

      const nextQuote = preparedQuote || (await requestQuote());
      if (!nextQuote) {
        throw new Error("Unable to prepare the direct swap request.");
      }

      setTransactionFlow(buildFlow("swap", "submitting", nextQuote));
      setStatus("Opening MiniMask to sign the on-chain swap request.");

      const state = {
        0: "SWAP",
        1: nextQuote.fromToken,
        2: nextQuote.toToken,
        3: String(nextQuote.amount),
        4: String(nextQuote.receiveAmount),
        5: nextQuote.fromTokenId || "",
        6: nextQuote.toTokenId || "",
        7: "DIRECT_ONCHAIN"
      };

      const sendResult = await send(
        nextQuote.directSendAmount || DEFAULT_SIGNAL_AMOUNT,
        address,
        {
          state,
          tokenid: nextQuote.directSendTokenId || "0x00"
        }
      );

      const txpowid = extractTxPowId(sendResult);
      if (!txpowid) {
        throw new Error("MiniMask did not return a transaction id.");
      }

      const recordId = txpowid || `swap-${Date.now()}`;
      setHistory((current) =>
        mergeHistoryRecord(current, {
          createdAt: Date.now(),
          id: recordId,
          metadataOnly: nextQuote.metadataOnly,
          mode: "DIRECT_ONCHAIN",
          quote: nextQuote,
          recipientAddress: address,
          status: "submitted",
          statusDetail: buildHistoryPatch("swap", "submitted").statusDetail,
          txpowid,
          type: "swap",
          updatedAt: Date.now(),
          walletAddress: address
        })
      );

      setTransactionFlow(buildFlow("swap", "submitted", nextQuote, txpowid));
      setStatus("Submitted to Minima. Waiting for chain confirmation.");
      await Promise.allSettled([refreshWallet ? refreshWallet() : Promise.resolve()]);
      beginPolling(recordId, "swap", nextQuote, txpowid);

      return {
        quote: nextQuote,
        txpowid
      };
    } catch (error) {
      const fallbackQuote = preparedQuote || previewQuote || {
        amount: Number(form.amount || 0),
        fromToken: form.fromToken,
        receiveAmount: "0",
        toToken: form.toToken
      };
      setTransactionFlow(buildFlow("swap", "failed", fallbackQuote));
      setStatus(error.message || "Unable to execute the on-chain swap request.");
      setHistoryError(error.message || "Unable to execute the on-chain swap request.");
      throw error;
    } finally {
      setSwapLoading(false);
    }
  }, [
    address,
    beginPolling,
    form.amount,
    form.fromToken,
    form.toToken,
    previewQuote,
    quote,
    refreshWallet,
    requestQuote,
    send,
    swapDisabledReason
  ]);

  const executeSend = useCallback(async (transactionOverride = null) => {
    const nextTransaction = normalizeSendTransaction(transactionOverride || sendForm, sendForm.token);
    const nextSourceBalance = getTokenSendableBalance(sendableBalances, nextTransaction.token);
    const nextSendDisabledReason = getSendDisabledReason({
      address,
      amount: nextTransaction.amount,
      recipientAddress: nextTransaction.address,
      sourceBalance: nextSourceBalance,
      token: nextTransaction.token
    });

    setSendLoading(true);
    setHistoryError("");

    try {
      if (nextSendDisabledReason) {
        throw new Error(nextSendDisabledReason);
      }

      setTransactionFlow(buildFlow("send", "submitting", nextTransaction));
      setStatus("Preparing transaction in MiniMask.");

      const sendResult = await send(nextTransaction.amount, nextTransaction.address, {
        state: {
          0: "SEND",
          1: nextTransaction.token,
          2: nextTransaction.amount,
          3: nextTransaction.address,
          4: "WALLET_ASSISTANT"
        },
        tokenid: getTokenId(nextTransaction.token) || "0x00"
      });

      const txpowid = extractTxPowId(sendResult);
      if (!txpowid) {
        throw new Error("MiniMask did not return a transaction id.");
      }

      const recordId = txpowid || `send-${Date.now()}`;
      setHistory((current) =>
        mergeHistoryRecord(current, {
          amount: nextTransaction.amount,
          createdAt: Date.now(),
          id: recordId,
          recipientAddress: nextTransaction.address,
          status: "submitted",
          statusDetail: buildHistoryPatch("send", "submitted").statusDetail,
          token: nextTransaction.token,
          txpowid,
          type: "send",
          updatedAt: Date.now(),
          walletAddress: address
        })
      );

      setTransactionFlow(buildFlow("send", "submitted", nextTransaction, txpowid));
      setStatus("Submitted to Minima. Waiting for chain confirmation.");
      await Promise.allSettled([refreshWallet ? refreshWallet() : Promise.resolve()]);
      beginPolling(recordId, "send", nextTransaction, txpowid);

      return {
        transaction: nextTransaction,
        txpowid
      };
    } catch (error) {
      setTransactionFlow(buildFlow("send", "failed", nextTransaction));
      setStatus(error.message || "Unable to submit the wallet send.");
      setHistoryError(error.message || "Unable to submit the wallet send.");
      throw error;
    } finally {
      setSendLoading(false);
    }
  }, [address, beginPolling, refreshWallet, send, sendForm, sendableBalances]);

  const applyAiQuote = useCallback((nextQuote) => {
    if (!nextQuote) {
      return;
    }

    setForm({
      amount: String(nextQuote.amount ?? ""),
      fromToken: nextQuote.fromToken || "MINIMA",
      toToken: nextQuote.toToken || "USDT"
    });
    setQuote(
      buildDirectSwapQuote(
        nextQuote.amount,
        nextQuote.fromToken,
        nextQuote.toToken,
        address,
        marketPrices
      )
    );
    setStatus(
      `Assistant staged ${nextQuote.amount} ${nextQuote.fromToken} -> ${nextQuote.receiveAmount} ${nextQuote.toToken}.`
    );
  }, [address, marketPrices]);

  const applyAiSend = useCallback((nextDraft) => {
    if (!nextDraft) {
      return;
    }

    setSendForm((current) => ({
      ...current,
      address: nextDraft.address || current.address,
      amount: String(nextDraft.amount ?? current.amount ?? ""),
      token: nextDraft.token || current.token
    }));
    setStatus(`Assistant staged a ${nextDraft.amount} ${nextDraft.token} settlement request.`);
  }, []);

  const resetUiState = useCallback(() => {
    setQuote(null);
    setHistoryError("");
    setTransactionFlow(null);
    setForm((current) => ({
      ...current,
      amount: "0"
    }));
    setSendForm((current) => ({
      ...current,
      address: "",
      amount: "0"
    }));
  }, []);

  const refreshAll = useCallback(async (options = {}) => {
    const { resetUi = false, walletRefreshed = false } = options;
    setHistoryLoading(true);
    setHistoryError("");

    try {
      if (resetUi) {
        resetUiState();
      }

      await Promise.allSettled([
        walletRefreshed ? Promise.resolve() : refreshWallet ? refreshWallet() : Promise.resolve()
      ]);
      setStatus(address ? config.statusLabel : DEFAULT_STATUS_MESSAGE);
    } finally {
      setHistoryLoading(false);
    }
  }, [address, config.statusLabel, refreshWallet, resetUiState]);

  const setField = useCallback((field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  }, []);

  const setSendField = useCallback((field, value) => {
    setSendForm((current) => ({
      ...current,
      [field]: value
    }));
  }, []);

  const flipTokens = useCallback(() => {
    setForm((current) => {
      if (current.toToken === current.fromToken) {
        return current;
      }

      return {
        ...current,
        fromToken: current.toToken,
        toToken: current.fromToken
      };
    });
  }, []);

  useEffect(() => {
    setStatus(address ? config.statusLabel : DEFAULT_STATUS_MESSAGE);
  }, [address, config.statusLabel]);

  useEffect(() => {
    updateCachedSwapSession({
      history,
      historyError,
      quote,
      status,
      transactionFlow
    });
  }, [history, historyError, quote, status, transactionFlow]);

  useEffect(() => {
    if (!quote) {
      return;
    }

    const quoteAmount = Number(quote.amount || 0);
    const formAmount = Number(form.amount || 0);

    if (
      quote.fromToken !== form.fromToken ||
      quote.toToken !== form.toToken ||
      quoteAmount !== formAmount
    ) {
      setQuote(null);
    }
  }, [form, quote]);

  useEffect(() => {
    if (!ownedTokenBalances.length) {
      return;
    }

    const primaryOwnedToken = ownedTokenBalances[0].symbol || ownedTokenBalances[0].token;
    const alternateToken = availableTokens.find((token) => token !== primaryOwnedToken) || primaryOwnedToken;

    setForm((current) => {
      if (getTokenSendableBalance(sendableBalances, current.fromToken) > 0) {
        return current;
      }

      const nextFromToken = primaryOwnedToken;
      const nextToToken = current.toToken === nextFromToken ? alternateToken : current.toToken;

      if (
        current.fromToken === nextFromToken &&
        current.toToken === nextToToken
      ) {
        return current;
      }

      return {
        ...current,
        fromToken: nextFromToken,
        toToken: nextToToken
      };
    });

    setSendForm((current) => {
      if (getTokenSendableBalance(sendableBalances, current.token) > 0 || current.amount || current.address) {
        return current;
      }

      if (current.token === primaryOwnedToken) {
        return current;
      }

      return {
        ...current,
        token: primaryOwnedToken
      };
    });
  }, [availableTokens, ownedTokenBalances, sendableBalances]);

  useEffect(() => stopPolling, [stopPolling]);

  return {
    activeQuote: quote,
    applyAiQuote,
    applyAiSend,
    availableTokens,
    config,
    configLoading: false,
    executeSend,
    executeSwap,
    form,
    flipTokens,
    history,
    historyError,
    historyLoading,
    ownedTokenBalances,
    previewQuote,
    quoteLoading,
    refreshAll,
    requestQuote,
    resetUiState,
    sendDisabledReason,
    sendForm,
    sendLoading,
    sendSourceBalance,
    setField,
    setSendField,
    sourceBalance,
    status,
    swapDisabledReason,
    swapLoading,
    transactionFlow,
    zeroBalanceWarning: ZERO_BALANCE_WARNING
  };
}
