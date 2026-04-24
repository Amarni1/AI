const KNOWN_TOKEN_IDS = {
  MINIMA: "0x00",
  USDT: import.meta.env.VITE_SWAP_TOKEN_ID_USDT || "0x7E6E60E033C7F74400B02F270074D0DA99FB863C33F8EA75078219258DCFC6CE"
};

const PRICE_TOLERANCE = 0.0001;

function toNumeric(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatAmount(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value ?? "0");
  }

  return numeric.toFixed(8).replace(/\.?0+$/, "") || "0";
}

function extractBalancePayload(rawBalance) {
  const payload =
    rawBalance?.balance ??
    rawBalance?.response?.balance ??
    rawBalance?.data?.balance ??
    rawBalance?.response ??
    rawBalance?.data ??
    rawBalance;

  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.balance)) {
    return payload.balance;
  }

  return [];
}

function normalizeTokenSymbol(value) {
  const safeValue = String(value || "").trim();
  if (!safeValue) {
    return "";
  }

  if (safeValue === "0x00") {
    return "MINIMA";
  }

  return safeValue.toUpperCase();
}

function inferTokenSymbol(record, fallback = "") {
  const tokenId = String(record?.tokenid || record?.tokenId || "").trim();
  if (tokenId === "0x00") {
    return "MINIMA";
  }

  const candidates = [
    record?.symbol,
    record?.name,
    record?.token,
    record?.token?.symbol,
    record?.token?.name,
    record?.details?.symbol,
    record?.details?.name,
    record?.label,
    fallback
  ];

  for (const candidate of candidates) {
    const normalized = normalizeTokenSymbol(candidate);
    if (normalized) {
      return normalized;
    }
  }

  if (tokenId) {
    return `${tokenId.slice(0, 6)}...${tokenId.slice(-4)}`.toUpperCase();
  }

  return "";
}

function readTokenId(record, symbol = "") {
  return String(record?.tokenid || record?.tokenId || KNOWN_TOKEN_IDS[symbol] || "").trim();
}

function readConfirmed(record) {
  return toNumeric(
    record?.confirmed ??
      record?.sendable ??
      record?.balance ??
      record?.amount ??
      record?.tokenamount ??
      0
  );
}

function getCoinAmount(coin, tokenId) {
  return toNumeric(tokenId === "0x00" ? coin?.amount : coin?.tokenamount ?? coin?.amount);
}

function mergeDexToken(target, source) {
  return {
    ...target,
    ...source,
    coinlist: source.coinlist?.length ? source.coinlist : target.coinlist || [],
    sendable: formatAmount(Math.max(toNumeric(target.sendable), toNumeric(source.sendable))),
    amount: formatAmount(Math.max(toNumeric(target.amount), toNumeric(source.amount))),
    confirmed: formatAmount(Math.max(toNumeric(target.confirmed), toNumeric(source.confirmed))),
    source: source.source || target.source
  };
}

export function buildWalletScript(publicKey) {
  const safeKey = String(publicKey || "").trim();
  return safeKey ? `RETURN SIGNEDBY(${safeKey})` : "";
}

export function normalizeDexBalances(rawBalance, sendableBalances = []) {
  const registry = new Map();

  const rawEntries = extractBalancePayload(rawBalance).map((record, index) => {
    const symbol = inferTokenSymbol(record, `TOKEN-${index + 1}`);
    const tokenId = readTokenId(record, symbol);

    return {
      amount: formatAmount(readConfirmed(record)),
      coinlist: Array.isArray(record?.coinlist) ? record.coinlist : [],
      confirmed: formatAmount(readConfirmed(record)),
      id: tokenId || `${symbol}-${index}`,
      raw: record,
      sendable: formatAmount(readConfirmed(record)),
      source: "meg",
      symbol,
      tokenId
    };
  });

  const normalizedEntries = (sendableBalances || []).map((record, index) => {
    const symbol = inferTokenSymbol(record, `TOKEN-${index + 1}`);
    const tokenId = readTokenId(record, symbol);

    return {
      amount: formatAmount(record?.amount ?? record?.sendable ?? 0),
      coinlist: Array.isArray(record?.coinlist) ? record.coinlist : [],
      confirmed: formatAmount(record?.confirmed ?? record?.amount ?? record?.sendable ?? 0),
      id: tokenId || `${symbol}-wallet-${index}`,
      raw: record,
      sendable: formatAmount(record?.sendable ?? record?.amount ?? 0),
      source: "wallet",
      symbol,
      tokenId
    };
  });

  [...rawEntries, ...normalizedEntries].forEach((entry) => {
    const key = entry.tokenId || entry.symbol;
    if (!key) {
      return;
    }

    const current = registry.get(key);
    registry.set(key, current ? mergeDexToken(current, entry) : entry);
  });

  return Array.from(registry.values()).sort((left, right) => {
    const leftOwned = toNumeric(left.sendable) > 0 ? 1 : 0;
    const rightOwned = toNumeric(right.sendable) > 0 ? 1 : 0;

    if (leftOwned !== rightOwned) {
      return rightOwned - leftOwned;
    }

    const leftBalance = toNumeric(left.sendable);
    const rightBalance = toNumeric(right.sendable);

    if (leftBalance !== rightBalance) {
      return rightBalance - leftBalance;
    }

    return left.symbol.localeCompare(right.symbol);
  });
}

export function resolveDexToken(tokens = [], token) {
  const normalized = normalizeTokenSymbol(token);
  return (
    tokens.find(
      (entry) =>
        normalizeTokenSymbol(entry?.symbol) === normalized ||
        String(entry?.tokenId || "").trim().toUpperCase() === normalized
    ) || null
  );
}

export function getMarketKey(baseTokenId, quoteTokenId) {
  return `${String(baseTokenId || "").trim()}::${String(quoteTokenId || "").trim()}`;
}

export function getOppositeSide(side) {
  return side === "bid" ? "ask" : "bid";
}

export function sortBookOrders(orders = [], side) {
  return [...orders]
    .filter((order) => order.side === side)
    .sort((left, right) => {
      if (side === "bid") {
        return right.price - left.price || left.createdAt - right.createdAt;
      }

      return left.price - right.price || left.createdAt - right.createdAt;
    });
}

export function buildDepthLevels(orders = [], side) {
  const grouped = new Map();

  sortBookOrders(orders, side).forEach((order) => {
    const key = Number(order.price).toFixed(4);
    const current = grouped.get(key) || {
      orders: 0,
      price: Number(order.price),
      quantity: 0
    };

    current.orders += 1;
    current.quantity += toNumeric(order.remaining);
    grouped.set(key, current);
  });

  const levels = Array.from(grouped.values()).map((entry) => ({
    ...entry,
    quantity: Number(entry.quantity.toFixed(8))
  }));

  return levels.sort((left, right) => {
    if (side === "bid") {
      return right.price - left.price;
    }

    return left.price - right.price;
  });
}

export function isCompatiblePrice(side, price, restingPrice) {
  const incoming = toNumeric(price);
  const resting = toNumeric(restingPrice);

  if (side === "bid") {
    return incoming >= resting;
  }

  return incoming <= resting;
}

export function estimatePriceForFill(orders = [], quantity, side) {
  const ordered = sortBookOrders(orders, side === "bid" ? "ask" : "bid");
  const requested = toNumeric(quantity);
  let filled = 0;
  let lastPrice = 0;

  for (const order of ordered) {
    const available = toNumeric(order.remaining);
    if (available <= 0) {
      continue;
    }

    filled += Math.min(available, requested - filled);
    lastPrice = Number(order.price);

    if (filled + PRICE_TOLERANCE >= requested) {
      return {
        filled: Number(filled.toFixed(8)),
        price: lastPrice
      };
    }
  }

  return null;
}

export function deriveTradeTerms(order, quantity) {
  const tradeQuantity = toNumeric(quantity);
  const notional = Number((tradeQuantity * toNumeric(order.price)).toFixed(8));

  if (order.side === "ask") {
    return {
      makerReceivesAmount: formatAmount(notional),
      makerReceivesToken: order.quoteToken,
      makerReceivesTokenId: order.quoteTokenId,
      makerSendsAmount: formatAmount(tradeQuantity),
      makerSendsToken: order.baseToken,
      makerSendsTokenId: order.baseTokenId,
      takerReceivesAmount: formatAmount(tradeQuantity),
      takerReceivesToken: order.baseToken,
      takerReceivesTokenId: order.baseTokenId,
      takerSendsAmount: formatAmount(notional),
      takerSendsToken: order.quoteToken,
      takerSendsTokenId: order.quoteTokenId
    };
  }

  return {
    makerReceivesAmount: formatAmount(tradeQuantity),
    makerReceivesToken: order.baseToken,
    makerReceivesTokenId: order.baseTokenId,
    makerSendsAmount: formatAmount(notional),
    makerSendsToken: order.quoteToken,
    makerSendsTokenId: order.quoteTokenId,
    takerReceivesAmount: formatAmount(notional),
    takerReceivesToken: order.quoteToken,
    takerReceivesTokenId: order.quoteTokenId,
    takerSendsAmount: formatAmount(tradeQuantity),
    takerSendsToken: order.baseToken,
    takerSendsTokenId: order.baseTokenId
  };
}

function selectCoins(balanceRecord, tokenId, amount, recipientAddress, ownerAddress) {
  const required = toNumeric(amount);
  if (!required || required < 0) {
    throw new Error("Invalid atomic trade amount.");
  }

  const coinlist = Array.isArray(balanceRecord?.coinlist) ? balanceRecord.coinlist : [];
  if (!coinlist.length) {
    throw new Error(`No spendable ${balanceRecord?.symbol || tokenId} coins are available.`);
  }

  let totalAdded = 0;
  let changeAddress = ownerAddress;
  const inputs = [];
  const outputs = [];

  for (const coin of coinlist) {
    const coinAmount = getCoinAmount(coin, tokenId);
    if (coinAmount <= 0) {
      continue;
    }

    inputs.push(coin.coinid);
    totalAdded += coinAmount;
    changeAddress = coin.miniaddress || ownerAddress;

    if (totalAdded + PRICE_TOLERANCE >= required) {
      break;
    }
  }

  if (totalAdded + PRICE_TOLERANCE < required) {
    throw new Error(`Not enough spendable ${balanceRecord?.symbol || tokenId} to build the trade.`);
  }

  outputs.push({
    address: recipientAddress,
    amount: formatAmount(required),
    storestate: false,
    tokenid: tokenId
  });

  const change = Number((totalAdded - required).toFixed(8));
  if (change > PRICE_TOLERANCE) {
    outputs.push({
      address: changeAddress || ownerAddress,
      amount: formatAmount(change),
      storestate: false,
      tokenid: tokenId
    });
  }

  return {
    inputs,
    outputs
  };
}

export function buildAtomicTradePlan(trade, takerProfile) {
  const makerBalances = normalizeDexBalances(trade.makerBalance);
  const takerBalances = normalizeDexBalances(takerProfile.balance);
  const makerSpendRecord = resolveDexToken(makerBalances, trade.makerSendsTokenId || trade.makerSendsToken);
  const takerSpendRecord = resolveDexToken(takerBalances, trade.takerSendsTokenId || trade.takerSendsToken);

  if (!makerSpendRecord) {
    throw new Error(`Counterparty does not have spendable ${trade.makerSendsToken}.`);
  }

  if (!takerSpendRecord) {
    throw new Error(`Your wallet does not have spendable ${trade.takerSendsToken}.`);
  }

  const takerSelection = selectCoins(
    takerSpendRecord,
    trade.takerSendsTokenId,
    trade.takerSendsAmount,
    trade.makerWallet,
    takerProfile.address
  );
  const makerSelection = selectCoins(
    makerSpendRecord,
    trade.makerSendsTokenId,
    trade.makerSendsAmount,
    takerProfile.address,
    trade.makerWallet
  );

  const scripts = [takerProfile.script, trade.makerScript].filter(Boolean);

  return {
    inputs: [...takerSelection.inputs, ...makerSelection.inputs],
    outputs: [...takerSelection.outputs, ...makerSelection.outputs],
    scripts,
    state: {
      0: "DEX_ATOMIC_TRADE",
      1: trade.marketKey,
      2: trade.id,
      3: formatAmount(trade.quantity),
      4: formatAmount(trade.price)
    }
  };
}

function extractTransaction(viewResult) {
  return (
    viewResult?.transaction ||
    viewResult?.response?.transaction ||
    viewResult?.data?.transaction ||
    viewResult?.response?.data?.transaction ||
    null
  );
}

function getWalletInputsOutputs(transaction, walletAddress) {
  const stats = {
    inputCoinIds: [],
    inputTokenId: "",
    inputTotal: 0,
    outputTokenId: "",
    outputTotal: 0
  };

  const inputs = Array.isArray(transaction?.inputs) ? transaction.inputs : [];
  inputs.forEach((input) => {
    if (input.miniaddress !== walletAddress) {
      return;
    }

    const tokenId = String(input.tokenid || "");
    if (stats.inputTokenId && stats.inputTokenId !== tokenId) {
      throw new Error("Trade transaction spends multiple token types from your wallet.");
    }

    stats.inputTokenId = tokenId;
    stats.inputTotal += getCoinAmount(input, tokenId);
    stats.inputCoinIds.push(input.coinid);
  });

  const outputs = Array.isArray(transaction?.outputs) ? transaction.outputs : [];
  outputs.forEach((output) => {
    if (output.miniaddress !== walletAddress) {
      return;
    }

    const tokenId = String(output.tokenid || "");
    const amount = getCoinAmount(output, tokenId);

    if (tokenId === stats.inputTokenId) {
      stats.inputTotal -= amount;
      return;
    }

    if (stats.outputTokenId && stats.outputTokenId !== tokenId) {
      throw new Error("Trade transaction credits multiple token types to your wallet.");
    }

    stats.outputTokenId = tokenId;
    stats.outputTotal += amount;
  });

  return {
    ...stats,
    inputTotal: Number(stats.inputTotal.toFixed(8)),
    outputTotal: Number(stats.outputTotal.toFixed(8))
  };
}

export function validateIncomingTrade(trade, viewResult, walletAddress) {
  const transaction = extractTransaction(viewResult);
  if (!transaction) {
    throw new Error("Trade validation failed because the transaction could not be decoded.");
  }

  const walletStats = getWalletInputsOutputs(transaction, walletAddress);
  const isMaker = trade.makerWallet === walletAddress;
  const expectedInputTokenId = isMaker ? trade.makerSendsTokenId : trade.takerSendsTokenId;
  const expectedOutputTokenId = isMaker ? trade.makerReceivesTokenId : trade.takerReceivesTokenId;
  const expectedInputAmount = toNumeric(isMaker ? trade.makerSendsAmount : trade.takerSendsAmount);
  const expectedOutputAmount = toNumeric(isMaker ? trade.makerReceivesAmount : trade.takerReceivesAmount);

  if (walletStats.inputTokenId !== expectedInputTokenId) {
    throw new Error("Trade input token does not match the order terms.");
  }

  if (walletStats.outputTokenId !== expectedOutputTokenId) {
    throw new Error("Trade output token does not match the order terms.");
  }

  if (Math.abs(walletStats.inputTotal - expectedInputAmount) > PRICE_TOLERANCE) {
    throw new Error("Trade input amount does not match the agreed order size.");
  }

  if (Math.abs(walletStats.outputTotal - expectedOutputAmount) > PRICE_TOLERANCE) {
    throw new Error("Trade output amount does not match the agreed execution price.");
  }

  return {
    inputAmount: formatAmount(walletStats.inputTotal),
    inputTokenId: walletStats.inputTokenId,
    outputAmount: formatAmount(walletStats.outputTotal),
    outputTokenId: walletStats.outputTokenId
  };
}

export function buildMarketSummary(bestBid, bestAsk, totalBidDepth, totalAskDepth) {
  return {
    bestAsk: bestAsk ? Number(bestAsk.price).toFixed(4) : "--",
    bestBid: bestBid ? Number(bestBid.price).toFixed(4) : "--",
    depth: `${formatAmount(totalBidDepth)} / ${formatAmount(totalAskDepth)}`
  };
}
