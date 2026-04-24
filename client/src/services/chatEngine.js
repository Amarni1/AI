import { getTokenPriceCards } from "./swapEngine";
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

function normalizeToken(token) {
  return String(token || "").trim().toUpperCase();
}

function resolveContext(context = {}) {
  if (typeof context === "string") {
    return {
      blockNumber: null,
      dexContext: {
        availableTokens: [],
        currentMarket: { baseToken: "MINIMA", quoteToken: "USDT" },
        marketSummaries: []
      },
      prices: {},
      sendableBalances: [],
      walletAddress: context
    };
  }

  return {
    blockNumber: context?.blockNumber ?? null,
    dexContext: context?.dexContext || {
      availableTokens: [],
      currentMarket: { baseToken: "MINIMA", quoteToken: "USDT" },
      marketSummaries: []
    },
    prices: context?.prices || {},
    sendableBalances: context?.sendableBalances || [],
    walletAddress: context?.walletAddress || context?.address || ""
  };
}

function findMarketSummary(dexContext, baseToken, quoteToken) {
  const safeBase = normalizeToken(baseToken) || normalizeToken(dexContext?.currentMarket?.baseToken) || "MINIMA";
  const safeQuote =
    normalizeToken(quoteToken) || normalizeToken(dexContext?.currentMarket?.quoteToken) || "USDT";

  return (
    dexContext?.marketSummaries?.find(
      (market) =>
        normalizeToken(market.baseToken) === safeBase && normalizeToken(market.quoteToken) === safeQuote
    ) || null
  );
}

function parseSendDraft(message) {
  const match = message.match(
    /(?:send|transfer)\s+(zero|\d+(\.\d+)?)\s+([a-z]+)\s+to\s+([a-z0-9]+)/i
  );

  if (!match) {
    return null;
  }

  return {
    address: match[4],
    amount: match[1].toLowerCase() === "zero" ? "0" : match[1],
    token: normalizeToken(match[3])
  };
}

function parseDexOrder(message, dexContext) {
  const match = message.match(
    /\b(buy|sell)\s+(\d+(\.\d+)?)\s+([a-z0-9]+)(?:\s+(?:for|with|against|vs)\s+([a-z0-9]+))?(?:\s+at\s+(\d+(\.\d+)?))?/i
  );

  if (!match) {
    return null;
  }

  const side = match[1].toLowerCase();
  const quantity = match[2];
  const baseToken = normalizeToken(match[4]);
  const quoteToken = normalizeToken(match[5]) || normalizeToken(dexContext?.currentMarket?.quoteToken) || "USDT";
  const explicitPrice = match[6] ? String(match[6]) : "";
  const market = findMarketSummary(dexContext, baseToken, quoteToken);

  if (!explicitPrice) {
    if (side === "buy") {
      if (!market?.bestAsk) {
        return {
          intent: "DEX_INFO",
          reply:
            `No live best ask is available for ${baseToken}/${quoteToken}. ` +
            `Say "buy ${quantity} ${baseToken.toLowerCase()} at 0.5000 ${quoteToken.toLowerCase()}" to post a bid instead.`
        };
      }

      return {
        intent: "DEX_ORDER",
        dexAction: {
          order: {
            baseToken,
            price: String(market.bestAsk),
            quantity,
            quoteToken,
            side
          },
          type: "PLACE_ORDER"
        },
        reply:
          `Placing a live BUY order for ${quantity} ${baseToken} on ${baseToken}/${quoteToken} ` +
          `at the current best ask of $${Number(market.bestAsk).toFixed(4)}. ` +
          "Any unfilled remainder will stay on the book."
      };
    }

    if (!market?.bestBid) {
      return {
        intent: "DEX_INFO",
        reply:
          `No live best bid is available for ${baseToken}/${quoteToken}. ` +
          `Say "sell ${quantity} ${baseToken.toLowerCase()} at 0.5000 ${quoteToken.toLowerCase()}" to post an ask instead.`
      };
    }

    return {
      intent: "DEX_ORDER",
      dexAction: {
        order: {
          baseToken,
          price: String(market.bestBid),
          quantity,
          quoteToken,
          side
        },
        type: "PLACE_ORDER"
      },
      reply:
        `Placing a live SELL order for ${quantity} ${baseToken} on ${baseToken}/${quoteToken} ` +
        `at the current best bid of $${Number(market.bestBid).toFixed(4)}. ` +
        "Any unfilled remainder will stay on the book."
    };
  }

  return {
    intent: "DEX_ORDER",
    dexAction: {
      order: {
        baseToken,
        price: explicitPrice,
        quantity,
        quoteToken,
        side
      },
      type: "PLACE_ORDER"
    },
    reply:
      `Placing a live ${side.toUpperCase()} order for ${quantity} ${baseToken} on ${baseToken}/${quoteToken} ` +
      `at $${Number(explicitPrice).toFixed(4)}.`
  };
}

function parseBestAsk(message, dexContext) {
  if (!/best ask/i.test(message)) {
    return null;
  }

  const tokenMatch = message.match(/best ask(?:\s+for)?\s+([a-z0-9]+)(?:\/([a-z0-9]+))?/i);
  const baseToken = normalizeToken(tokenMatch?.[1] || dexContext?.currentMarket?.baseToken || "MINIMA");
  const quoteToken = normalizeToken(tokenMatch?.[2] || dexContext?.currentMarket?.quoteToken || "USDT");
  const market = findMarketSummary(dexContext, baseToken, quoteToken);

  if (!market?.bestAsk) {
    return {
      intent: "DEX_INFO",
      reply: `There is no live ask on ${baseToken}/${quoteToken} right now.`
    };
  }

  return {
    intent: "DEX_INFO",
    reply:
      `Best ask on ${baseToken}/${quoteToken} is $${Number(market.bestAsk).toFixed(4)} ` +
      `with ${formatDisplayedAmount(market.totalAskDepth)} ${baseToken} visible on the ask side.`
  };
}

export function respondToMessage(message, context = {}) {
  const safeMessage = sanitizeMessage(message);
  const normalized = safeMessage.toLowerCase();
  const { blockNumber, dexContext, prices, sendableBalances, walletAddress } = resolveContext(context);
  const ownedTokens = getOwnedTokenBalances(sendableBalances);

  const dexOrder = parseDexOrder(safeMessage, dexContext);
  if (dexOrder) {
    return dexOrder;
  }

  const bestAsk = parseBestAsk(safeMessage, dexContext);
  if (bestAsk) {
    return bestAsk;
  }

  if (/\bcancel\b.*\border|\border.*\bcancel/i.test(normalized) || normalized.includes("cancel orders")) {
    return {
      dexAction: {
        type: "CANCEL_ALL"
      },
      intent: "DEX_CANCEL",
      reply: "Cancelling every open order from this wallet on the live DEX."
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
    if (sendableBalance <= 0 && Number(sendDraft.amount) > 0) {
      return {
        intent: "BALANCE_LIMIT",
        reply: "Insufficient sendable balance."
      };
    }

    if (Number(sendDraft.amount) > sendableBalance) {
      return {
        intent: "BALANCE_LIMIT",
        reply:
          `Insufficient sendable balance. You only have ${formatDisplayedAmount(sendableBalance)} ${sendDraft.token} sendable.`
      };
    }

    return {
      intent: "SEND",
      reply:
        `I prepared a MiniMask send for ${sendDraft.amount} ${sendDraft.token} to ` +
        `${formatWalletAddress(sendDraft.address)}. Review the confirmation prompt and sign when ready.`,
      sendDraft
    };
  }

  if (normalized.includes("open exchange")) {
    return {
      intent: "OPEN_EXCHANGE",
      openMode: "exchange",
      reply: "The live orderbook is ready. I opened the exchange overlay."
    };
  }

  if (normalized.includes("refresh balances") || normalized.includes("refresh wallet")) {
    return {
      intent: "REFRESH",
      requestRefresh: true,
      reply: "Refreshing wallet, balances, prices, blocks, and the live exchange book now."
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
          : "MiniMask is connected, but I do not see any sendable tokens yet."
    };
  }

  if (normalized.includes("do i have enough balance") || normalized.includes("enough balance")) {
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
        "Zero-balance mode is active when MiniMask reports no sendable funds. In that state, only commands using amount 0 are allowed, such as 'Send 0 minima to Mx...'."
    };
  }

  if (/(hello|hi|hey|good morning|good afternoon|good evening)/.test(normalized)) {
    return {
      intent: "GREETING",
      reply: walletAddress
        ? `MiniMask is connected at ${formatWalletAddress(walletAddress)}. ${getPortfolioSummary(
            sendableBalances
          )}`
        : "MiniMask flow is ready. Connect your wallet and I can help with live balances, orderbook actions, and secure sends."
    };
  }

  if (normalized.includes("sendable balance")) {
    return {
      intent: "BALANCE_HELP",
      reply:
        "Sendable balance is what MiniMask says you can spend right now. The DEX uses that live value to validate orders before they hit the book."
    };
  }

  if (
    normalized.includes("send funds") ||
    normalized.includes("send money") ||
    normalized.includes("how do i send")
  ) {
    return {
      intent: "SEND_HELP",
      reply:
        "Say something like 'Send 2 minima to Mx...' and I will stage the details in the MiniMask confirmation flow."
    };
  }

  if (normalized.includes("wallet") || normalized.includes("connect")) {
    return {
      intent: "WALLET_HELP",
      reply: walletAddress
        ? `MiniMask is connected. Use refresh to reload ${getPortfolioSummary(sendableBalances)}.`
        : "Use Connect Wallet to detect MiniMask, then refresh to sync your live sendable balances into the DEX."
    };
  }

  if (normalized.includes("blockchain")) {
    return {
      intent: "BLOCKCHAIN_HELP",
      reply:
        "The exchange posts real orders to a live book, builds raw transactions in the browser, and uses MiniMask to sign or post each atomic trade on Minima."
    };
  }

  if (normalized.includes("show latest block") || normalized.includes("latest block")) {
    return {
      intent: "BLOCK",
      reply:
        blockNumber !== null
          ? `Latest visible Minima block: #${blockNumber}.`
          : "I cannot read the latest Minima block yet. Refresh once MiniMask is available."
    };
  }

  if (normalized.includes("minima")) {
    return {
      intent: "MINIMA_INFO",
      reply:
        "Minima is a lightweight blockchain designed for decentralization at the edge. In this portal, MiniMask is the secure bridge for balances, live orders, and atomic DEX trades."
    };
  }

  return {
    intent: "UNKNOWN",
    reply:
      "Ask me to buy or sell on the live book, cancel orders, show the best ask, check your balance, list tokens, or stage a secure MiniMask send."
  };
}
