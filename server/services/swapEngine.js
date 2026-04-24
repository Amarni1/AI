export const TOKEN_PRICES = {
  MINIMA: 0.5,
  USDT: 1
};

const DEFAULT_SIGNAL_AMOUNT = String(process.env.SWAP_SIGNAL_AMOUNT || "0.0001");

const TOKEN_IDS = {
  MINIMA: "0x00",
  USDT: process.env.SWAP_TOKEN_ID_USDT || "0x7E6E60E033C7F74400B02F270074D0DA99FB863C33F8EA75078219258DCFC6CE"
};

export const TOKEN_OPTIONS = Object.keys(TOKEN_PRICES);

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

export function buildSwapQuote(amount, fromToken, toToken) {
  const source = normalizeTokenSymbol(fromToken);
  const target = normalizeTokenSymbol(toToken);
  const numericAmount = Number(amount);

  if (!source || !target || !Number.isFinite(numericAmount) || numericAmount <= 0) {
    return null;
  }

  if (source === target) {
    return null;
  }

  const usdValue = numericAmount * TOKEN_PRICES[source];
  const fromTokenId = getTokenId(source);
  const toTokenId = getTokenId(target);

  return {
    amount: numericAmount,
    directSendAmount: fromTokenId ? String(numericAmount) : DEFAULT_SIGNAL_AMOUNT,
    directSendTokenId: fromTokenId || "0x00",
    executionReady: true,
    fromToken: source,
    fromTokenId,
    metadataOnly: !fromTokenId || !toTokenId,
    receiveAmount: (usdValue / TOKEN_PRICES[target]).toFixed(4),
    signalAmount: DEFAULT_SIGNAL_AMOUNT,
    toToken: target,
    toTokenId,
    usdValue: usdValue.toFixed(2)
  };
}

export function getPriceTable() {
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
    bestToken,
    fromToken: source,
    reply: `${bestToken} is the only other configured swap token in this app.`
  };
}
