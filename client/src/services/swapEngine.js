export const TOKEN_PRICES = {
  MINIMA: 0.5,
  USDT: 1,
  USDC: 1,
  MA: 3,
  LUCOS: 0.1,
  GRETES: 0.2
};

export const TOKEN_OPTIONS = Object.keys(TOKEN_PRICES);

export function normalizeTokenSymbol(token) {
  const normalized = String(token || "").trim().toUpperCase();
  return TOKEN_OPTIONS.includes(normalized) ? normalized : null;
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
  return TOKEN_OPTIONS.map((token) => ({
    token,
    price: TOKEN_PRICES[token]
  }));
}

export function buildBestSwapSuggestion(fromToken) {
  const source = normalizeTokenSymbol(fromToken);
  if (!source) {
    return null;
  }

  const candidates = TOKEN_OPTIONS.filter((token) => token !== source);
  const bestToken = candidates.reduce((best, current) =>
    TOKEN_PRICES[current] > TOKEN_PRICES[best] ? current : best
  );

  return {
    fromToken: source,
    bestToken,
    message:
      bestToken === "MA"
        ? `${bestToken} has the highest unit price at $${TOKEN_PRICES[bestToken]}. If you want stability instead, USDT and USDC remain at $1.`
        : `${bestToken} is currently the highest-priced option versus ${source}.`
  };
}

export function formatSwapSummary(quote) {
  return `${quote.amount} ${quote.fromToken} = ${quote.receiveAmount} ${quote.toToken}`;
}
