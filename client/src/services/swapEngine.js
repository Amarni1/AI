export const TOKEN_PRICES = {
  MINIMA: 0.5,
  USDT: 1
};

export const TOKEN_OPTIONS = Object.keys(TOKEN_PRICES);
export const DEFAULT_SIGNAL_AMOUNT = String(import.meta.env.VITE_SWAP_SIGNAL_AMOUNT || "0.0001");

const TOKEN_IDS = {
  MINIMA: "0x00",
  USDT: import.meta.env.VITE_SWAP_TOKEN_ID_USDT || "0x7E6E60E033C7F74400B02F270074D0DA99FB863C33F8EA75078219258DCFC6CE"
};

export function normalizeTokenSymbol(token) {
  const normalized = String(token || "").trim().toUpperCase();
  return TOKEN_OPTIONS.includes(normalized) ? normalized : null;
}

export function getTokenId(token) {
  const normalized = normalizeTokenSymbol(token);
  return normalized ? TOKEN_IDS[normalized] || "" : "";
}

export function getTokenDefinitions() {
  return TOKEN_OPTIONS.map((token) => ({
    configured: Boolean(getTokenId(token)),
    price: TOKEN_PRICES[token],
    symbol: token,
    tokenId: getTokenId(token)
  }));
}

export function convertSwapAmount(amount, fromToken, toToken) {
  const source = normalizeTokenSymbol(fromToken);
  const target = normalizeTokenSymbol(toToken);

  if (!source || !target) {
    return null;
  }

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return null;
  }

  const usdValue = numericAmount * TOKEN_PRICES[source];
  return {
    amount: numericAmount,
    fromToken: source,
    priceFrom: TOKEN_PRICES[source],
    priceTo: TOKEN_PRICES[target],
    receiveAmount: (usdValue / TOKEN_PRICES[target]).toFixed(4),
    toToken: target,
    usdValue: usdValue.toFixed(2)
  };
}

export function getTokenPriceCards() {
  return getTokenDefinitions().map((token) => ({
    configured: token.configured,
    price: token.price,
    token: token.symbol,
    tokenId: token.tokenId
  }));
}

export function buildBestSwapSuggestion(fromToken) {
  const source = normalizeTokenSymbol(fromToken);
  if (!source) {
    return null;
  }

  const bestToken = source === "MINIMA" ? "USDT" : "MINIMA";

  return {
    fromToken: source,
    bestToken,
    message: `${bestToken} is the only other configured swap token in this app.`
  };
}

export function formatSwapSummary(quote) {
  return `${quote.amount} ${quote.fromToken} = ${quote.receiveAmount} ${quote.toToken}`;
}

export function buildDirectModeConfig(walletAddress = "") {
  return {
    message:
      "Transactions are signed in MiniMask, written directly to the Minima blockchain, and tracked client-side until confirmation.",
    mode: "DIRECT_ONCHAIN",
    modeLabel: "Direct On-Chain Mode",
    recipientAddress: walletAddress || "Connect MiniMask",
    signalAmount: DEFAULT_SIGNAL_AMOUNT,
    statusLabel: walletAddress ? "Direct On-Chain Mode Active" : "Awaiting wallet connection",
    tokens: getTokenDefinitions()
  };
}

export function buildDirectSwapQuote(amount, fromToken, toToken, walletAddress = "") {
  const quote = convertSwapAmount(amount, fromToken, toToken);

  if (!quote) {
    return null;
  }

  const fromTokenId = getTokenId(quote.fromToken);
  const toTokenId = getTokenId(quote.toToken);
  const directSendTokenId = fromTokenId || "0x00";
  const directSendAmount = fromTokenId ? String(quote.amount) : DEFAULT_SIGNAL_AMOUNT;
  const metadataOnly = !fromTokenId || !toTokenId;

  return {
    ...quote,
    directSendAmount,
    directSendTokenId,
    fromTokenId,
    metadataOnly,
    mode: "DIRECT_ONCHAIN",
    recipientAddress: walletAddress || "",
    signalAmount: DEFAULT_SIGNAL_AMOUNT,
    toTokenId
  };
}
