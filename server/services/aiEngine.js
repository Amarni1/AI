import { parseIntent } from "./intentParser.js";
import { buildBestSwapSuggestion, buildSwapQuote, getPriceTable } from "./swapEngine.js";
import { requireConfirmation, validateTransaction } from "./transactionValidator.js";

export function handleChatMessage(message) {
  const parsed = parseIntent(message);

  if (parsed.intent === "GREETING") {
    return {
      intent: "GREETING",
      message: "Welcome to Minima AI. I can guide wallet actions, explain Minima, and help with blockchain concepts.",
      reply: "Welcome to Minima AI. I can guide wallet actions, explain Minima, and help with blockchain concepts."
    };
  }

  if (parsed.intent === "BALANCE") {
    return {
      intent: "BALANCE",
      message: "Use the wallet panel to refresh MiniMask and inspect your live token balances.",
      reply: "Use the wallet panel to refresh MiniMask and inspect your live token balances."
    };
  }

  if (parsed.intent === "ADDRESS") {
    return {
      intent: "ADDRESS",
      message: "Connect MiniMask and I will surface your active wallet address in the dashboard.",
      reply: "Connect MiniMask and I will surface your active wallet address in the dashboard."
    };
  }

  if (parsed.intent === "PRICE_LIST") {
    const priceTable = getPriceTable();

    return {
      intent: "PRICE_LIST",
      message: "Current token prices loaded.",
      reply: priceTable.map((item) => `${item.token} = $${item.price}`).join("\n"),
      priceTable
    };
  }

  if (parsed.intent === "PRICE_QUERY") {
    const quote = buildSwapQuote(parsed.amount, parsed.fromToken, parsed.toToken);

    if (!quote) {
      return {
        intent: "PRICE_QUERY",
        message: "Unable to generate that quote.",
        reply: "Unable to generate that quote."
      };
    }

    return {
      intent: "PRICE_QUERY",
      message: `${quote.amount} ${quote.fromToken} = ${quote.receiveAmount} ${quote.toToken}`,
      reply: `${quote.amount} ${quote.fromToken} = ${quote.receiveAmount} ${quote.toToken}`,
      swapQuote: quote
    };
  }

  if (parsed.intent === "BEST_SWAP") {
    const suggestion = buildBestSwapSuggestion(parsed.fromToken);

    if (!suggestion) {
      return {
        intent: "BEST_SWAP",
        message: "I couldn't determine the best swap target.",
        reply: "I couldn't determine the best swap target."
      };
    }

    return {
      intent: "BEST_SWAP",
      message: suggestion.reply,
      reply: suggestion.reply
    };
  }

  if (parsed.intent === "WALLET_HELP") {
    return {
      intent: "WALLET_HELP",
      message: "For wallet help: connect MiniMask, refresh balances, review the address card, and confirm transfers only after checking the recipient and amount.",
      reply: "For wallet help: connect MiniMask, refresh balances, review the address card, and confirm transfers only after checking the recipient and amount."
    };
  }

  if (parsed.intent === "SWAP_QUOTE") {
    const quote = buildSwapQuote(parsed.amount, parsed.fromToken, parsed.toToken);

    if (!quote) {
      return {
        intent: "SWAP_QUOTE",
        message: "I couldn't build that swap quote.",
        reply: "I couldn't build that swap quote."
      };
    }

    return {
      intent: "SWAP_QUOTE",
      message: `${quote.amount} ${quote.fromToken} = ${quote.receiveAmount} ${quote.toToken}`,
      reply: `${quote.amount} ${quote.fromToken} = ${quote.receiveAmount} ${quote.toToken}\n\nProceed with swap?`,
      swapQuote: quote
    };
  }

  if (parsed.intent === "BLOCKCHAIN_HELP") {
    return {
      intent: "BLOCKCHAIN_HELP",
      message: "Blockchains group transactions into verifiable blocks, and wallets like MiniMask let you sign actions so the network can verify ownership without exposing private keys.",
      reply: "Blockchains group transactions into verifiable blocks, and wallets like MiniMask let you sign actions so the network can verify ownership without exposing private keys."
    };
  }

  if (parsed.intent === "HELP") {
    return {
      intent: "HELP",
      message: "I can help with greetings, wallet setup, addresses, balances, secure send guidance, Minima education, and core blockchain concepts.",
      reply: "I can help with greetings, wallet setup, addresses, balances, secure send guidance, Minima education, and core blockchain concepts."
    };
  }

  if (parsed.intent === "SEND") {
    const validation = validateTransaction({
      amount: parsed.amount,
      address: parsed.address
    });

    if (!validation.ok) {
      return {
        intent: "SEND",
        confirmationRequired: false,
        message: validation.issues[0]?.message ?? "Invalid transaction request.",
        reply: validation.issues[0]?.message ?? "Invalid transaction request.",
        issues: validation.issues
      };
    }

    return {
      intent: "SEND",
      reply: `Please confirm in MiniMask before sending ${validation.transaction.amount} Minima to ${validation.transaction.address}.`,
      ...requireConfirmation(validation.transaction)
    };
  }

  if (parsed.intent === "MINIMA_INFO") {
    return {
      intent: "MINIMA_INFO",
      message: "Minima is a lightweight blockchain network designed for decentralization at the edge, allowing users to run and verify from mobile and smaller devices.",
      reply: "Minima is a lightweight blockchain network designed for decentralization at the edge, allowing users to run and verify from mobile and smaller devices."
    };
  }

  return {
    intent: "UNKNOWN",
    message: "Ask me about wallet setup, token balances, secure sends, Minima, or how blockchain systems work.",
    reply: "Ask me about wallet setup, token balances, secure sends, Minima, or how blockchain systems work."
  };
}
