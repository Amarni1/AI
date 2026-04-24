import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MiniMask } from "../services/minimask";
import {
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
  buildDirectSwapQuote
} from "../services/swapEngine";

const DEFAULT_STATUS_MESSAGE = "Connect MiniMask to activate Direct On-Chain Mode.";

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
  const nextId = nextRecord.id || nextRecord.txpowid || `swap-${Date.now()}`;

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

export function useSwapDex({ address, refreshWallet, send }) {
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [swapLoading, setSwapLoading] = useState(false);
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

  const pollTimerRef = useRef(null);
  const activeSwapIdRef = useRef("");

  const config = useMemo(() => buildDirectModeConfig(address), [address]);
  const availableTokens = useMemo(() => TOKEN_OPTIONS, []);
  const previewQuote = useMemo(
    () => buildDirectSwapQuote(form.amount, form.fromToken, form.toToken, address),
    [address, form.amount, form.fromToken, form.toToken]
  );

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const requestQuote = useCallback(async (override = {}) => {
    setQuoteLoading(true);

    try {
      const nextQuote = buildDirectSwapQuote(
        override.amount ?? form.amount,
        override.fromToken ?? form.fromToken,
        override.toToken ?? form.toToken,
        address
      );

      if (!nextQuote) {
        throw new Error("Unable to build a quote for that swap pair.");
      }

      setQuote(nextQuote);
      setStatus(
        nextQuote.metadataOnly
          ? "Quote ready. This will be recorded as a direct on-chain swap request."
          : "Quote ready. MiniMask will create a token-aware on-chain swap signal."
      );
      return nextQuote;
    } catch (error) {
      setStatus(error.message || "Unable to prepare the swap quote.");
      throw error;
    } finally {
      setQuoteLoading(false);
    }
  }, [address, form.amount, form.fromToken, form.toToken]);

  const beginPolling = useCallback((recordId, nextQuote, txpowid) => {
    stopPolling();
    activeSwapIdRef.current = recordId;
    const startedAt = Date.now();

    setTransactionFlow(buildSwapFlow("processing", nextQuote, txpowid));
    setHistory((current) =>
      updateHistoryRecord(current, recordId, {
        status: "processing",
        statusDetail: "Waiting for on-chain confirmation.",
        txpowid
      })
    );
    setStatus("Processing on-chain confirmation.");

    pollTimerRef.current = window.setInterval(async () => {
      try {
        if (Date.now() - startedAt >= TX_CONFIRMATION_TIMEOUT_MS) {
          stopPolling();
          setTransactionFlow(buildSwapFlow("timeout", nextQuote, txpowid));
          setHistory((current) =>
            updateHistoryRecord(current, recordId, {
              status: "timeout",
              statusDetail: "Still waiting for on-chain confirmation.",
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
        setTransactionFlow(buildSwapFlow("success", nextQuote, txpowid));
        setHistory((current) =>
          updateHistoryRecord(current, recordId, {
            status: "success",
            statusDetail: "Confirmed on network.",
            txpowid
          })
        );
        setStatus("Direct on-chain swap request confirmed on network.");
        await Promise.allSettled([refreshWallet ? refreshWallet() : Promise.resolve()]);
      } catch (error) {
        stopPolling();
        setTransactionFlow(buildSwapFlow("failed", nextQuote, txpowid));
        setHistory((current) =>
          updateHistoryRecord(current, recordId, {
            status: "failed",
            statusDetail: error.message || "Unable to verify transaction confirmation.",
            txpowid
          })
        );
        setStatus(error.message || "Unable to verify transaction confirmation.");
      }
    }, TX_POLL_INTERVAL_MS);
  }, [refreshWallet, stopPolling]);

  const executeSwap = useCallback(async () => {
    const preparedQuote = quote || previewQuote;
    setSwapLoading(true);

    try {
      if (!address) {
        throw new Error("Connect MiniMask before submitting a swap.");
      }

      const nextQuote = preparedQuote || (await requestQuote());
      if (!nextQuote) {
        throw new Error("Unable to prepare the direct swap request.");
      }

      setTransactionFlow(buildSwapFlow("submitting", nextQuote));
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
          metadataOnly: nextQuote.metadataOnly,
          mode: "DIRECT_ONCHAIN",
          quote: nextQuote,
          recipientAddress: address,
          status: "submitted",
          statusDetail: nextQuote.metadataOnly
            ? "Submitted a direct on-chain swap request with metadata state variables."
            : "Submitted a direct on-chain self-transfer with swap metadata.",
          txpowid,
          updatedAt: Date.now(),
          walletAddress: address
        })
      );

      setTransactionFlow(buildSwapFlow("submitted", nextQuote, txpowid));
      setStatus("Submitted to Minima. Waiting for chain confirmation.");
      await Promise.allSettled([refreshWallet ? refreshWallet() : Promise.resolve()]);
      beginPolling(recordId, nextQuote, txpowid);

      return {
        quote: nextQuote,
        txpowid
      };
    } catch (error) {
      setTransactionFlow(buildSwapFlow("failed", preparedQuote || previewQuote || {
        amount: Number(form.amount || 0),
        fromToken: form.fromToken,
        receiveAmount: "0",
        toToken: form.toToken
      }));
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
    send
  ]);

  const applyAiQuote = useCallback((nextQuote) => {
    if (!nextQuote) {
      return;
    }

    setForm({
      amount: String(nextQuote.amount ?? ""),
      fromToken: nextQuote.fromToken || "MINIMA",
      toToken: nextQuote.toToken || "USDT"
    });
    setQuote(buildDirectSwapQuote(
      nextQuote.amount,
      nextQuote.fromToken,
      nextQuote.toToken,
      address
    ));
    setStatus(
      `AI staged ${nextQuote.amount} ${nextQuote.fromToken} -> ${nextQuote.receiveAmount} ${nextQuote.toToken}.`
    );
  }, [address]);

  const refreshAll = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError("");

    try {
      await Promise.allSettled([refreshWallet ? refreshWallet() : Promise.resolve()]);
      setStatus(address ? config.statusLabel : DEFAULT_STATUS_MESSAGE);
    } finally {
      setHistoryLoading(false);
    }
  }, [address, config.statusLabel, refreshWallet]);

  const setField = useCallback((field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  }, []);

  const flipTokens = useCallback(() => {
    setForm((current) => ({
      ...current,
      fromToken: current.toToken,
      toToken: current.fromToken
    }));
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

  useEffect(() => stopPolling, [stopPolling]);

  return {
    activeQuote: quote,
    applyAiQuote,
    availableTokens,
    config,
    configLoading: false,
    executeSwap,
    form,
    flipTokens,
    history,
    historyError,
    historyLoading,
    previewQuote,
    quoteLoading,
    refreshAll,
    requestQuote,
    setField,
    status,
    swapLoading,
    transactionFlow
  };
}
