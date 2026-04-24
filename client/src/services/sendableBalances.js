import { TOKEN_OPTIONS, TOKEN_PRICES } from "./swapEngine";

const KNOWN_TOKEN_IDS = {
  MINIMA: "0x00",
  USDT: "0x7E6E60E033C7F74400B02F270074D0DA99FB863C33F8EA75078219258DCFC6CE"
};

function formatAmount(value) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return String(value ?? "0");
  }

  return numeric.toFixed(4).replace(/\.?0+$/, "") || "0";
}

function extractBalanceList(rawBalance) {
  const payload = rawBalance?.data || rawBalance?.response || rawBalance || [];

  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload.balance)) {
    return payload.balance;
  }

  return [];
}

function inferSymbol(record) {
  const tokenId = String(record?.tokenid || record?.tokenId || "").trim();

  if (tokenId === KNOWN_TOKEN_IDS.MINIMA) {
    return "MINIMA";
  }

  if (tokenId && tokenId === KNOWN_TOKEN_IDS.USDT) {
    return "USDT";
  }

  const candidates = [
    record?.symbol,
    record?.name,
    record?.token?.symbol,
    record?.token?.name,
    record?.details?.symbol,
    record?.details?.name,
    record?.label
  ];

  for (const candidate of candidates) {
    const normalized = String(candidate || "").trim().toUpperCase();
    if (normalized) {
      return normalized;
    }
  }

  return tokenId === "0x00" ? "MINIMA" : "";
}

function readNumeric(record, ...keys) {
  for (const key of keys) {
    const candidate = record?.[key];
    const numeric = Number(candidate);

    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }

  return 0;
}

export function buildFallbackSendableBalances(tokenBalances = []) {
  return tokenBalances.map((item) => {
    const symbol = String(item.token || "").trim().toUpperCase();
    const numericAmount = Number(item.amount || 0);

    return {
      amount: String(item.amount ?? "0"),
      confirmed: String(item.amount ?? "0"),
      configured: TOKEN_OPTIONS.includes(symbol),
      decimals: 8,
      id: item.id || symbol || item.tokenId || "token",
      price: TOKEN_PRICES[symbol] || 0,
      sendable: String(item.amount ?? "0"),
      symbol: TOKEN_OPTIONS.includes(symbol) ? symbol : item.token,
      token: TOKEN_OPTIONS.includes(symbol) ? symbol : item.token,
      tokenId: item.tokenId || "",
      unconfirmed: "0",
      usdValue: Number.isFinite(numericAmount * (TOKEN_PRICES[symbol] || 0))
        ? (numericAmount * (TOKEN_PRICES[symbol] || 0)).toFixed(2)
        : "0.00"
    };
  });
}

export function normalizeSendableBalances(rawBalance) {
  const mapped = extractBalanceList(rawBalance)
    .map((record, index) => {
      const symbol = inferSymbol(record);

      if (!symbol) {
        return null;
      }

      const confirmed = readNumeric(record, "confirmed", "amount", "balance");
      const unconfirmed = readNumeric(record, "unconfirmed");
      const sendable = confirmed;

      return {
        amount: formatAmount(sendable),
        coins: Number(record?.coins || record?.coinlist?.length || 0),
        confirmed: formatAmount(confirmed),
        configured: Boolean(KNOWN_TOKEN_IDS[symbol] || record?.tokenid || record?.tokenId),
        decimals: Number(record?.token?.decimals || record?.details?.decimals || record?.decimals || 8),
        id: record?.tokenid || record?.tokenId || `${symbol}-${index}`,
        price: TOKEN_PRICES[symbol] || 0,
        sendable: formatAmount(sendable),
        symbol,
        token: symbol,
        tokenId: String(record?.tokenid || record?.tokenId || KNOWN_TOKEN_IDS[symbol] || ""),
        unconfirmed: formatAmount(unconfirmed),
        usdValue: ((TOKEN_PRICES[symbol] || 0) * sendable).toFixed(2)
      };
    })
    .filter(Boolean);

  const availableSymbols = Array.from(
    new Set([...TOKEN_OPTIONS, ...mapped.map((item) => item.symbol).filter(Boolean)])
  );

  return availableSymbols
    .map((symbol) => {
      const existing = mapped.find((item) => item.symbol === symbol);

      if (existing) {
        return existing;
      }

      return {
        amount: "0",
        coins: 0,
        confirmed: "0",
        configured: Boolean(KNOWN_TOKEN_IDS[symbol]),
        decimals: 8,
        id: symbol,
        price: TOKEN_PRICES[symbol] || 0,
        sendable: "0",
        symbol,
        token: symbol,
        tokenId: KNOWN_TOKEN_IDS[symbol] || "",
        unconfirmed: "0",
        usdValue: "0.00"
      };
    })
    .sort((left, right) => {
      const leftOwned = Number(left.sendable || 0) > 0 ? 1 : 0;
      const rightOwned = Number(right.sendable || 0) > 0 ? 1 : 0;

      if (leftOwned !== rightOwned) {
        return rightOwned - leftOwned;
      }

      return Number(right.usdValue) - Number(left.usdValue);
    });
}
