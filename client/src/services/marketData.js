export const DEFAULT_MARKET_PRICES = {
  MINIMA: 0.5,
  USDT: 1
};

const COINGECKO_IDS = {
  MINIMA: "minima",
  USDT: "tether"
};

function normalizePrice(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function formatUsdPrice(value) {
  const numeric = Number(value);
  return `$${(Number.isFinite(numeric) ? numeric : 0).toFixed(2)}`;
}

export async function fetchLivePrices() {
  const url =
    "https://api.coingecko.com/api/v3/simple/price?ids=minima,tether&vs_currencies=usd&include_last_updated_at=true";

  const response = await fetch(url, {
    headers: {
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error("Unable to load live token prices.");
  }

  const payload = await response.json();

  return Object.entries(COINGECKO_IDS).reduce((result, [symbol, id]) => {
    result[symbol] = normalizePrice(payload?.[id]?.usd, DEFAULT_MARKET_PRICES[symbol]);
    return result;
  }, {});
}
