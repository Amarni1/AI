export function formatHistoryTimestamp(timestamp) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(timestamp));
}

export function compactHash(value) {
  const safeValue = String(value || "");

  if (!safeValue) {
    return "Unavailable";
  }

  if (safeValue.length <= 18) {
    return safeValue;
  }

  return `${safeValue.slice(0, 10)}...${safeValue.slice(-6)}`;
}

export function formatSwapHistorySummary(item) {
  if (!item?.quote) {
    return "Swap request";
  }

  return `${item.quote.amount} ${item.quote.fromToken} -> ${item.quote.receiveAmount} ${item.quote.toToken}`;
}

export function formatHistoryLabel(item) {
  return item?.type === "send" ? "Exchange Settlement" : "Direct Swap";
}

export function formatHistorySummary(item) {
  if (item?.type === "send") {
    const amount = item?.amount || "0";
    const token = item?.token || "MINIMA";
    const recipient = compactHash(item?.recipientAddress || item?.address);
    return `${amount} ${token} sent to ${recipient}`;
  }

  return formatSwapHistorySummary(item);
}
