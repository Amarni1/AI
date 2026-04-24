import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchLivePrices, formatUsdPrice, DEFAULT_MARKET_PRICES } from "../services/marketData";
import { MiniMask } from "../services/minimask";

const PRICE_REFRESH_MS = 45000;
const BLOCK_REFRESH_MS = 5000;

function parseBlockNumber(result) {
  const numeric = Number(result);
  return Number.isFinite(numeric) ? numeric : null;
}

export function usePortalInsights({ isMiniMaskAvailable }) {
  const [prices, setPrices] = useState(DEFAULT_MARKET_PRICES);
  const [priceError, setPriceError] = useState("");
  const [pricesLoading, setPricesLoading] = useState(true);
  const [blockNumber, setBlockNumber] = useState(null);
  const [blockError, setBlockError] = useState("");
  const [blockLoading, setBlockLoading] = useState(true);

  const refreshPrices = useCallback(async () => {
    setPricesLoading(true);

    try {
      const nextPrices = await fetchLivePrices();
      setPrices(nextPrices);
      setPriceError("");
      return nextPrices;
    } catch (error) {
      setPriceError(error.message || "Unable to load live token prices.");
      return prices;
    } finally {
      setPricesLoading(false);
    }
  }, [prices]);

  const refreshBlock = useCallback(async () => {
    if (!isMiniMaskAvailable) {
      setBlockLoading(false);
      setBlockError("");
      return null;
    }

    setBlockLoading(true);

    try {
      const result = await MiniMask.blockAsync();
      const nextBlock = parseBlockNumber(result);

      if (nextBlock === null) {
        throw new Error("Unable to read the latest Minima block.");
      }

      setBlockNumber(nextBlock);
      setBlockError("");
      return nextBlock;
    } catch (error) {
      setBlockError(error.message || "Unable to read the latest Minima block.");
      return null;
    } finally {
      setBlockLoading(false);
    }
  }, [isMiniMaskAvailable]);

  const refreshAll = useCallback(async () => {
    await Promise.allSettled([refreshPrices(), refreshBlock()]);
  }, [refreshBlock, refreshPrices]);

  useEffect(() => {
    void refreshPrices();

    const priceTimer = window.setInterval(() => {
      void refreshPrices();
    }, PRICE_REFRESH_MS);

    return () => window.clearInterval(priceTimer);
  }, [refreshPrices]);

  useEffect(() => {
    if (!isMiniMaskAvailable) {
      setBlockLoading(false);
      setBlockNumber(null);
      return undefined;
    }

    void refreshBlock();

    const blockTimer = window.setInterval(() => {
      void refreshBlock();
    }, BLOCK_REFRESH_MS);

    return () => window.clearInterval(blockTimer);
  }, [isMiniMaskAvailable, refreshBlock]);

  const priceCards = useMemo(
    () => [
      { label: "MINIMA", value: formatUsdPrice(prices.MINIMA), numeric: prices.MINIMA },
      { label: "USDT", value: formatUsdPrice(prices.USDT), numeric: prices.USDT }
    ],
    [prices]
  );

  return {
    blockError,
    blockLoading,
    blockNumber,
    priceCards,
    priceError,
    prices,
    pricesLoading,
    refreshAll,
    refreshBlock,
    refreshPrices
  };
}
