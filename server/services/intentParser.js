import { z } from "zod";
import { normalizeTokenSymbol } from "./swapEngine.js";

export const messageSchema = z.object({
  message: z.string().trim().min(1).max(500)
});

function sanitizeMessage(message) {
  return message.replace(/[<>]/g, "").trim();
}

function extractAmount(message) {
  const match = message.match(/(\d+(\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function extractAddress(message) {
  const match = message.match(/(mx[a-z0-9]+)/i);
  return match ? match[1] : null;
}

function parseSwapQuote(message) {
  const match = message.match(
    /(?:swap|convert|trade|exchange)\s+(\d+(\.\d+)?)\s+([a-z]+)\s+(?:to|for|into)\s+([a-z]+)/i
  );

  if (!match) {
    return null;
  }

  const fromToken = normalizeTokenSymbol(match[3]);
  const toToken = normalizeTokenSymbol(match[4]);

  if (!fromToken || !toToken) {
    return null;
  }

  return {
    amount: Number(match[1]),
    fromToken,
    intent: "SWAP_QUOTE",
    toToken
  };
}

function parsePriceQuery(message) {
  const match = message.match(
    /(?:how much is|what is|quote)\s+(\d+(\.\d+)?)\s+([a-z]+)\s+(?:in|to)\s+([a-z]+)/i
  );

  if (!match) {
    return null;
  }

  const fromToken = normalizeTokenSymbol(match[3]);
  const toToken = normalizeTokenSymbol(match[4]);

  if (!fromToken || !toToken) {
    return null;
  }

  return {
    amount: Number(match[1]),
    fromToken,
    intent: "PRICE_QUERY",
    toToken
  };
}

function parseBestSwap(message) {
  const match = message.match(/best token to swap\s+([a-z]+)\s+into/i);
  if (!match) {
    return null;
  }

  const fromToken = normalizeTokenSymbol(match[1]);
  if (!fromToken) {
    return null;
  }

  return {
    fromToken,
    intent: "BEST_SWAP"
  };
}

export function parseIntent(message) {
  const safeMessage = sanitizeMessage(message);
  const normalized = safeMessage.toLowerCase();

  const swapQuote = parseSwapQuote(safeMessage);
  if (swapQuote) {
    return swapQuote;
  }

  const priceQuery = parsePriceQuery(safeMessage);
  if (priceQuery) {
    return priceQuery;
  }

  const bestSwap = parseBestSwap(safeMessage);
  if (bestSwap) {
    return bestSwap;
  }

  if (
    normalized.includes("show token prices") ||
    normalized === "show prices" ||
    normalized === "show token price" ||
    normalized.includes("token prices")
  ) {
    return { intent: "PRICE_LIST" };
  }

  if (/(hello|hi|hey|good morning|good afternoon|good evening)/.test(normalized)) {
    return { intent: "GREETING" };
  }

  if (normalized.includes("balance")) {
    return { intent: "BALANCE" };
  }

  if (normalized.includes("address")) {
    return { intent: "ADDRESS" };
  }

  if (normalized.includes("wallet") || normalized.includes("connect")) {
    return { intent: "WALLET_HELP" };
  }

  if (normalized.includes("blockchain")) {
    return { intent: "BLOCKCHAIN_HELP" };
  }

  if (normalized.includes("help")) {
    return { intent: "HELP" };
  }

  if (normalized.includes("send")) {
    return {
      intent: "SEND",
      amount: extractAmount(safeMessage),
      address: extractAddress(safeMessage)
    };
  }

  if (normalized.includes("minima")) {
    return { intent: "MINIMA_INFO" };
  }

  return { intent: "UNKNOWN" };
}
