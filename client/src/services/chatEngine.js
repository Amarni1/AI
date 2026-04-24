import {
  buildBestSwapSuggestion,
  buildDirectModeConfig,
  buildDirectSwapQuote,
  getTokenPriceCards,
  normalizeTokenSymbol
} from "./swapEngine";
import {
  formatDisplayedAmount,
  getOwnedTokenBalances,
  getPortfolioSummary,
  getTokenSendableBalance
} from "./walletPortfolio";
import { formatWalletAddress } from "./walletData";

function sanitizeMessage(message) {
  return String(message || "").replace(/[<>]/g, "").trim();
}

function resolveContext(context = {}) {
  if (typeof context === "string") {
    return {
      blockNumber: null,
      prices: {},
      sendableBalances: [],
      walletAddress: context
    };
  }

  return {
    blockNumber: context?.blockNumber ?? null,
    prices: context?.prices || {},
    sendableBalances: context?.sendableBalances || [],
    walletAddress: context?.walletAddress || context?.address || ""
  };
}

function parseSwapQuote(message, walletAddress = "", prices = {}) {
  const match = message.match(
    /(?:swap|convert|trade|exchange)\s+(\d+(\.\d+)?)\s+([a-z]+)\s+(?:to|for|into)\s+([a-z]+)/i
  );

  if (!match) {
    return null;
  }

  return buildDirectSwapQuote(match[1], match[3], match[4], walletAddress, prices);
}

function parsePriceQuery(message, walletAddress = "", prices = {}) {
  const match = message.match(
    /(?:how much is|what is|quote)\s+(\d+(\.\d+)?)\s+([a-z]+)\s+(?:in|to)\s+([a-z]+)/i
  );

  if (!match) {
    return null;
  }

  return buildDirectSwapQuote(match[1], match[3], match[4], walletAddress, prices);
}

function parseBestSwap(message) {
  const match = message.match(/best token to swap\s+([a-z]+)\s+into/i);
  if (!match) {
    return null;
  }

  return normalizeTokenSymbol(match[1]);
}

function parseSendDraft(message) {
  const match = message.match(
    /(?:send|transfer)\s+(\d+(\.\d+)?)\s+([a-z]+)\s+to\s+([a-z0-9]+)/i
  );

  if (!match) {
    return null;
  }

  const token = normalizeTokenSymbol(match[3]);
  if (!token) {
    return null;
  }

  return {
    address: match[4],
    amount: match[1],
    token
  };
}

export function respondToMessage(message, context = {}) {
  const safeMessage = sanitizeMessage(message);
  const normalized = safeMessage.toLowerCase();
  const { blockNumber, prices, sendableBalances, walletAddress } = resolveContext(context);
  const ownedTokens = getOwnedTokenBalances(sendableBalances);
  const directMode = buildDirectModeConfig(walletAddress, prices);

  const swapQuote = parseSwapQuote(safeMessage, walletAddress, prices);
  if (swapQuote) {
    if (walletAddress) {
      const sourceBalance = getTokenSendableBalance(sendableBalances, swapQuote.fromToken);

      if (sourceBalance <= 0 && Number(swapQuote.amount) > 0) {
        return {
          intent: "ZERO_BALANCE_MODE",
          reply:
            `No sendable ${swapQuote.fromToken} is available right now. ` +
            `Only a zero-value command is allowed, for example: "Swap 0 ${swapQuote.fromToken.toLowerCase()} to ${swapQuote.toToken.toLowerCase()}".`
        };
      }

      if (Number(swapQuote.amount) > sourceBalance) {
        return {
          intent: "BALANCE_LIMIT",
          reply:
            `You only have ${formatDisplayedAmount(sourceBalance)} ${swapQuote.fromToken} sendable. ` +
            "Use an amount less than or equal to that balance."
        };
      }
    }

    return {
      intent: "SWAP_QUOTE",
      reply:
        `${swapQuote.amount} ${swapQuote.fromToken} = ${swapQuote.receiveAmount} ${swapQuote.toToken}\n\n` +
        "I staged that quote in the swap widget. Review it and sign in MiniMask when you're ready.",
      swapQuote
    };
  }

  const priceQuery = parsePriceQuery(safeMessage, walletAddress, prices);
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

  const sendDraft = parseSendDraft(safeMessage);
  if (sendDraft) {
    if (!walletAddress) {
      return {
        intent: "SEND_HELP",
        reply: "Connect MiniMask first so I can stage that send with your live wallet."
      };
    }

    const sendableBalance = getTokenSendableBalance(sendableBalances, sendDraft.token);
    if (sendableBalance <= 0) {
      return {
        intent: "ZERO_BALANCE_MODE",
        reply:
          `No sendable ${sendDraft.token} is available right now. ` +
          `Only a zero-value command is allowed, for example: "Send 0 ${sendDraft.token.toLowerCase()} to ${sendDraft.address}".`
      };
    }

    if (Number(sendDraft.amount) > sendableBalance) {
      return {
        intent: "SEND_HELP",
        reply:
          `You only have ${formatDisplayedAmount(sendableBalance)} ${sendDraft.token} sendable. ` +
          "Lower the amount or refresh your wallet data."
      };
    }

    return {
      intent: "SEND",
      reply:
        `I staged a MiniMask send for ${sendDraft.amount} ${sendDraft.token} to ` +
        `${formatWalletAddress(sendDraft.address)}. Review it in the action card and sign when ready.`,
      sendDraft
    };
  }

  if (normalized.includes("open exchange")) {
    return {
      intent: "OPEN_EXCHANGE",
      openMode: "exchange",
      reply: "Exchange mode is ready. I switched the action widget to direct settlement."
    };
  }

  if (normalized.includes("open swap")) {
    return {
      intent: "OPEN_SWAP",
      openMode: "swap",
      reply: "Swap mode is ready. I switched the widget to token conversion."
    };
  }

  if (normalized.includes("refresh balances") || normalized.includes("refresh wallet")) {
    return {
      intent: "REFRESH",
      requestRefresh: true,
      reply: "Refreshing wallet, balances, prices, block data, and activity now."
    };
  }

  if (
    normalized.includes("show token prices") ||
    normalized === "show prices" ||
    normalized.includes("token prices") ||
    normalized.includes("what is minima price") ||
    normalized.includes("what's minima price") ||
    normalized.includes("minima price")
  ) {
    return {
      intent: "PRICE_LIST",
      priceTable: getTokenPriceCards(prices),
      reply: getTokenPriceCards(prices).map((item) => `${item.token} = $${item.price}`).join("\n")
    };
  }

  if (
    /\bbalance\b|\bbalances\b|check balance|wallet balance|what do i have|what's my balance/.test(
      normalized
    )
  ) {
    if (!walletAddress) {
      return {
        intent: "BALANCE",
        reply: "Connect MiniMask first, then I can read your live sendable balances."
      };
    }

    return {
      intent: "BALANCE",
      reply:
        ownedTokens.length > 0
          ? `Your sendable balances are ${getPortfolioSummary(sendableBalances)}.`
          : "Your wallet is connected, but MiniMask is currently reporting zero sendable balance."
    };
  }

  if (normalized.includes("show my wallet")) {
    if (!walletAddress) {
      return {
        intent: "WALLET",
        reply: "Connect MiniMask first so I can show your live wallet details."
      };
    }

    return {
      intent: "WALLET",
      reply:
        `Wallet: ${formatWalletAddress(walletAddress)}\n` +
        `Sendable: ${getPortfolioSummary(sendableBalances)}`
    };
  }

  if (
    normalized.includes("detect tokens") ||
    normalized.includes("what tokens") ||
    normalized.includes("tokens available") ||
    normalized.includes("which tokens") ||
    normalized.includes("what do i own") ||
    normalized.includes("list my tokens")
  ) {
    if (!walletAddress) {
      return {
        intent: "TOKENS",
        reply: "Connect MiniMask first, then I can detect which tokens are currently sendable."
      };
    }

    return {
      intent: "TOKENS",
      reply:
        ownedTokens.length > 0
          ? `You currently own sendable ${ownedTokens.map((item) => item.symbol).join(" and ")}.`
          : "MiniMask is connected, but I don't see any sendable MINIMA or USDT yet."
    };
  }

  if (
    normalized.includes("do i have enough balance") ||
    normalized.includes("enough balance")
  ) {
    return {
      intent: "SUFFICIENCY",
      reply:
        ownedTokens.length > 0
          ? `Yes, you currently have ${getPortfolioSummary(sendableBalances)} available to sign from.`
          : "No sendable balance is available right now. Only zero-value actions are allowed."
    };
  }

  if (
    normalized.includes("no sendable balance detected") ||
    normalized.includes("zero balance mode") ||
    normalized.includes("zero-value command")
  ) {
    return {
      intent: "ZERO_BALANCE_MODE",
      reply:
        "Zero-balance mode is active when MiniMask reports no sendable funds. In that state, only commands using amount 0 are allowed, such as 'Send 0 minima to Mx...' or 'Swap 0 minima to usdt'."
    };
  }

  if (/(hello|hi|hey|good morning|good afternoon|good evening)/.test(normalized)) {
    return {
      intent: "GREETING",
      reply: walletAddress
        ? `MiniMask is connected at ${formatWalletAddress(walletAddress)}. ${getPortfolioSummary(
            sendableBalances
          )}`
        : "MiniMask flow is ready. Connect your wallet and I can help with live balances, swaps, and sends."
    };
  }

  if (normalized.includes("sendable balance")) {
    return {
      intent: "BALANCE_HELP",
      reply:
        "Sendable balance is what MiniMask says you can spend right now. The widget uses that live value to enable or disable swap and send actions."
    };
  }

  if (
    normalized.includes("send funds") ||
    normalized.includes("send money") ||
    normalized.includes("how do i send") ||
    normalized.includes("facilitate")
  ) {
    return {
      intent: "SEND_HELP",
      reply:
        "Say something like 'Send 2 minima to Mx...' and I'll stage the details in the MiniMask action widget for you."
    };
  }

  if (normalized.includes("wallet") || normalized.includes("connect")) {
    return {
      intent: "WALLET_HELP",
      reply: walletAddress
        ? `MiniMask is connected. Use refresh to reload ${getPortfolioSummary(sendableBalances)}.`
        : "Use Connect Wallet to detect MiniMask, then refresh to load your live sendable balances and available tokens."
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
        `${directMode.modeLabel} means the app prepares the transaction in the browser, MiniMask signs it locally, and the UI tracks confirmation directly from the Minima blockchain.`
    };
  }

  if (normalized.includes("blockchain")) {
    return {
      intent: "BLOCKCHAIN_HELP",
      reply:
        "Every send or swap request is signed in MiniMask, submitted to Minima, and checked with txpow confirmation polling before the UI marks it successful."
    };
  }

  if (normalized.includes("show latest block") || normalized.includes("latest block")) {
    return {
      intent: "BLOCK",
      reply:
        blockNumber !== null
          ? `Latest visible Minima block: #${blockNumber}.`
          : "I can't read the latest Minima block yet. Refresh once MiniMask is available."
    };
  }

  if (normalized.includes("minima")) {
    return {
      intent: "MINIMA_INFO",
      reply:
        "Minima is a lightweight blockchain designed for decentralization at the edge. In this dashboard, MiniMask is the secure bridge for balances, sends, and on-chain swap signals."
    };
  }

  return {
    intent: "UNKNOWN",
    reply:
      "Ask me to check your balance, detect tokens, stage a send, quote a swap, show token prices, or explain how MiniMask works."
  };
}
