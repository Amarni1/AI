const STORAGE_KEY = "minima-ai-recent-sends";
const MAX_RECENT_SENDS = 12;

function asArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && typeof value === "object") {
    if (Array.isArray(value.coins)) {
      return value.coins;
    }

    if (Array.isArray(value.transactions)) {
      return value.transactions;
    }

    if (Array.isArray(value.response)) {
      return value.response;
    }
  }

  return [];
}

function parseTimestamp(record) {
  const candidates = [
    record.time,
    record.timestamp,
    record.timemilli,
    record.created,
    record.date,
    record.block,
    record.blockCreated
  ];

  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null || candidate === "") {
      continue;
    }

    const numeric = Number(candidate);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric > 1e12 ? numeric : numeric * 1000;
    }

    const parsed = Date.parse(String(candidate));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return Date.now();
}

function parseAmount(record) {
  const candidates = [
    record.amount,
    record.value,
    record.coinamount,
    record.total,
    record.mmrtotal
  ];

  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null && candidate !== "") {
      return String(candidate);
    }
  }

  return "Unknown";
}

function parseAddress(record) {
  const candidates = [
    record.address,
    record.to,
    record.recipient,
    record.recipientAddress,
    record.miniaddress
  ];

  for (const candidate of candidates) {
    if (candidate) {
      return String(candidate);
    }
  }

  return "Wallet activity";
}

function parseDirection(record, activeAddress) {
  const candidate = String(
    record.direction || record.type || record.action || ""
  ).toLowerCase();

  if (candidate.includes("send") || candidate.includes("out")) {
    return "sent";
  }

  if (candidate.includes("receive") || candidate.includes("in")) {
    return "received";
  }

  const recipient = String(record.to || record.recipient || record.address || "").toLowerCase();
  const wallet = String(activeAddress || "").toLowerCase();

  if (wallet && recipient && recipient !== wallet) {
    return "sent";
  }

  return "received";
}

export function formatHistoryTimestamp(timestamp) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(timestamp));
}

export function getRecentSends() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveRecentSend(record) {
  if (typeof window === "undefined") {
    return;
  }

  const nextRecord = {
    id: record.id || `send-${Date.now()}`,
    kind: "local-send",
    direction: "sent",
    amount: String(record.amount),
    address: String(record.address),
    timestamp: record.timestamp || Date.now(),
    status: record.status || "Submitted in MiniMask",
    detail: record.detail || "",
    txpowid: record.txpowid || record.id || ""
  };

  const nextRecords = [nextRecord, ...getRecentSends()]
    .slice(0, MAX_RECENT_SENDS);

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecords));
}

export function updateRecentSend(recordId, patch) {
  if (typeof window === "undefined" || !recordId) {
    return;
  }

  const nextRecords = getRecentSends().map((record) =>
    record.id === recordId || record.txpowid === recordId
      ? { ...record, ...patch }
      : record
  );

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecords));
}

export function normalizeWalletHistory(rawCoins, activeAddress) {
  return asArray(rawCoins).map((record, index) => {
    const timestamp = parseTimestamp(record);
    const direction = parseDirection(record, activeAddress);

    return {
      id:
        record.coinid ||
        record.id ||
        record.txpowid ||
        record.tokenid ||
        `wallet-record-${timestamp}-${index}`,
      kind: "wallet",
      direction,
      amount: parseAmount(record),
      address: parseAddress(record),
      timestamp,
      status: record.status || (direction === "sent" ? "On-chain activity" : "Received in wallet"),
      detail: record.detail || "",
      raw: record
    };
  });
}

export function mergeHistory(rawCoins, activeAddress) {
  const walletRecords = normalizeWalletHistory(rawCoins, activeAddress);
  const localRecords = getRecentSends();

  return [...localRecords, ...walletRecords]
    .sort((left, right) => right.timestamp - left.timestamp)
    .filter(
      (record, index, collection) =>
        collection.findIndex((candidate) => candidate.id === record.id) === index
    );
}
