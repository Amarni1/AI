import {
  buildBestSwapSuggestion,
  buildDirectModeConfig,
  buildDirectSwapQuote,
  getTokenPriceCards,
  normalizeTokenSymbol
} from "./swapEngine";

function sanitizeMessage(message) {
  return String(message || "").replace(/[<>]/g, "").trim();
}

function extractAmount(message) {
  const match = message.match(/(\d+(\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function parseSwapQuote(message, walletAddress = "") {
  const match = message.match(
    /(?:swap|convert|trade|exchange)\s+(\d+(\.\d+)?)\s+([a-z]+)\s+(?:to|for|into)\s+([a-z]+)/i
  );

  if (!match) {
    return null;
  }

  return buildDirectSwapQuote(match[1], match[3], match[4], walletAddress);
}

function parsePriceQuery(message, walletAddress = "") {
  const match = message.match(
    /(?:how much is|what is|quote)\s+(\d+(\.\d+)?)\s+([a-z]+)\s+(?:in|to)\s+([a-z]+)/i
  );

  if (!match) {
    return null;
  }

  return buildDirectSwapQuote(match[1], match[3], match[4], walletAddress);
}

function parseBestSwap(message) {
  const match = message.match(/best token to swap\s+([a-z]+)\s+into/i);
  if (!match) {
    return null;
  }

  return normalizeTokenSymbol(match[1]);
}

export function respondToMessage(message, walletAddress = "") {
  const safeMessage = sanitizeMessage(message);
  const normalized = safeMessage.toLowerCase();
  const directMode = buildDirectModeConfig(walletAddress);

  const swapQuote = parseSwapQuote(safeMessage, walletAddress);
  if (swapQuote) {
    return {
      intent: "SWAP_QUOTE",
      reply:
        `${swapQuote.amount} ${swapQuote.fromToken} = ${swapQuote.receiveAmount} ${swapQuote.toToken}\n\n` +
        "This will create a real Minima transaction with swap metadata in the state variables.",
      swapQuote
    };
  }

  const priceQuery = parsePriceQuery(safeMessage, walletAddress);
  if (priceQuery) {
    return {
      intent: "PRICE_QUERY",
      reply: `${priceQuery.amount} ${priceQuery.fromToken} = ${priceQuery.receiveAmount} ${priceQuery.toToken}`,
      swapQuote: priceQuery
    };
  }

  const bestSwap = parseBestSwap(safeMessage);
  if (bestSwap) {
    const suggestion = buildBestSwapSuggestion(bestSwap);
    return {
      intent: "BEST_SWAP",
      reply: suggestion?.message || suggestion?.reply || "I couldn't determine the best swap target."
    };
  }

  if (
    normalized.includes("show token prices") ||
    normalized === "show prices" ||
    normalized.includes("token prices")
  ) {
    return {
      intent: "PRICE_LIST",
      priceTable: getTokenPriceCards(),
      reply: getTokenPriceCards().map((item) => `${item.token} = $${item.price}`).join("\n")
    };
  }

  if (/(hello|hi|hey|good morning|good afternoon|good evening)/.test(normalized)) {
    return {
      intent: "GREETING",
      reply:
        "MiniMask Connected flow ready. Direct On-Chain Mode signs swap requests locally and confirms them from the Minima blockchain."
    };
  }

  if (normalized.includes("sendable balance")) {
    return {
      intent: "BALANCE_HELP",
      reply:
        "Sendable balance is the amount your MiniMask wallet can spend right now. Refresh wallet data to load the latest sendable figures from balancefull()."
    };
  }

  if (normalized.includes("wallet") || normalized.includes("connect")) {
    return {
      intent: "WALLET_HELP",
      reply:
        "Use Connect Wallet to detect MiniMask, then refresh to load your address, token balances, and sendable amounts."
    };
  }

  if (
    normalized.includes("direct on-chain") ||
    normalized.includes("swap route") ||
    normalized.includes("how does")
  ) {
    return {
      intent: "MODE_HELP",
      reply:
        `${directMode.modeLabel} means the app creates a real MiniMask transaction and stores the swap request in state variables on-chain. ` +
        "There is no server-side payout flow and no automatic token settlement in this mode."
    };
  }

  if (normalized.includes("blockchain")) {
    return {
      intent: "BLOCKCHAIN_HELP",
      reply:
        "The swap button creates a real Minima blockchain transaction. MiniMask signs it locally, the network confirms it, and the UI tracks the txpow until it lands on-chain."
    };
  }

  if (normalized.includes("minima")) {
    return {
      intent: "MINIMA_INFO",
      reply:
        "Minima is a lightweight blockchain designed for decentralization at the edge. In this app, MiniMask is the bridge that signs and submits your on-chain swap requests."
    };
  }

  return {
    intent: "UNKNOWN",
    reply:
      "Ask me for a swap quote, token prices, sendable balance help, wallet setup, or how Direct On-Chain Mode works."
  };
}
