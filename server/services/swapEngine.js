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

export function buildSwapQuote(amount, fromToken, toToken) {
  const source = normalizeTokenSymbol(fromToken);
  const target = normalizeTokenSymbol(toToken);
  const numericAmount = Number(amount);

  if (!source || !target || !Number.isFinite(numericAmount) || numericAmount <= 0) {
    return null;
  }

  const usdValue = numericAmount * TOKEN_PRICES[source];

  return {
    amount: numericAmount,
    fromToken: source,
    toToken: target,
    receiveAmount: (usdValue / TOKEN_PRICES[target]).toFixed(4),
    usdValue: usdValue.toFixed(2)
  };
}

export function getPriceTable() {
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
  const sampleQuote = buildSwapQuote(10, source, bestToken);

  return {
    bestToken,
    fromToken: source,
    reply:
      bestToken === "MA"
        ? `By pure price, MA is the highest-priced target at $3. 10 ${source} would equal ${sampleQuote.receiveAmount} ${bestToken}. If you want stability instead, USDT and USDC stay at $1.`
        : `${bestToken} is currently the highest-priced token against ${source}.`
  };
}
