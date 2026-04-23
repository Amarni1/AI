import { formatWalletAddress } from "./walletData";

export const TX_POLL_INTERVAL_MS = 3000;
export const TX_CONFIRMATION_TIMEOUT_MS = 60000;

function compactStatusText(value) {
  return String(value || "").trim().toLowerCase();
}

export function extractTxPowId(result) {
  return (
    result?.txpowid ||
    result?.response?.txpowid ||
    result?.response?.id ||
    result?.id ||
    ""
  );
}

export function isTxConfirmed(result) {
  const payload = result?.response ?? result;

  if (typeof payload === "boolean") {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return false;
  }

  const booleanSignals = [
    payload.confirmed,
    payload.onchain,
    payload.onChain,
    payload.found,
    payload.success
  ];

  if (booleanSignals.some((signal) => signal === true)) {
    return true;
  }

  const numericSignals = [
    payload.depth,
    payload.confirmations,
    payload.block,
    payload.blockheight
  ];

  if (numericSignals.some((signal) => Number(signal) > 0)) {
    return true;
  }

  const textSignals = [
    payload.status,
    payload.message,
    payload.info,
    payload.result
  ]
    .map(compactStatusText)
    .filter(Boolean);

  return textSignals.some((signal) =>
    signal.includes("confirmed") ||
    signal.includes("on chain") ||
    signal.includes("onchain") ||
    signal.includes("found")
  );
}

export function buildTransactionFlow(phase, transaction, txpowid = "") {
  const summary = `${transaction.amount} Minima sent to ${formatWalletAddress(transaction.address)}`;

  if (phase === "submitted") {
    return {
      phase,
      txpowid,
      title: "Transaction Submitted",
      badge: "Submitted",
      summary,
      detail: "Send request submitted to MiniMask."
    };
  }

  if (phase === "processing") {
    return {
      phase,
      txpowid,
      title: "Transaction Processing",
      badge: "Processing",
      summary,
      detail: "Waiting for network confirmation."
    };
  }

  if (phase === "success") {
    return {
      phase,
      txpowid,
      title: "Transaction Successful",
      badge: "Confirmed",
      summary,
      detail: "Confirmed on network."
    };
  }

  if (phase === "timeout") {
    return {
      phase,
      txpowid,
      title: "Confirmation Timeout",
      badge: "Timed out",
      summary,
      detail: "Still waiting for on-chain confirmation."
    };
  }

  return {
    phase,
    txpowid,
    title: "Transaction Update",
    badge: "Update",
    summary,
    detail: "Tracking transaction status."
  };
}

export function buildSwapFlow(phase, quote, txpowid = "") {
  const summary = `${quote.amount} ${quote.fromToken} -> ${quote.receiveAmount} ${quote.toToken}`;

  if (phase === "submitting") {
    return {
      phase,
      txpowid,
      title: "Swap Submitting",
      badge: "Submitting",
      summary,
      detail: "Opening MiniMask and preparing the swap request."
    };
  }

  if (phase === "submitted") {
    return {
      phase,
      txpowid,
      title: "Swap Submitted",
      badge: "Submitted",
      summary,
      detail: "Swap request submitted to MiniMask."
    };
  }

  if (phase === "processing") {
    return {
      phase,
      txpowid,
      title: "Swap Processing",
      badge: "Processing",
      summary,
      detail: "Waiting for swap confirmation on network."
    };
  }

  if (phase === "success") {
    return {
      phase,
      txpowid,
      title: "Swap Successful",
      badge: "Confirmed",
      summary,
      detail: "Confirmed on network."
    };
  }

  if (phase === "timeout") {
    return {
      phase,
      txpowid,
      title: "Swap Confirmation Timeout",
      badge: "Timed out",
      summary,
      detail: "Still waiting for swap confirmation on network."
    };
  }

  if (phase === "failed") {
    return {
      phase,
      txpowid,
      title: "Swap Failed",
      badge: "Failed",
      summary,
      detail: "MiniMask could not submit the swap request."
    };
  }

  return {
    phase,
    txpowid,
    title: "Swap Update",
    badge: "Update",
    summary,
    detail: "Tracking swap status."
  };
}
