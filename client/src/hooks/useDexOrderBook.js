import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildAtomicTradePlan,
  buildDepthLevels,
  estimatePriceForFill,
  getMarketKey,
  normalizeDexBalances,
  resolveDexToken,
  sortBookOrders,
  validateIncomingTrade
} from "../services/dexEngine";
import { MiniMask } from "../services/minimask";
import { extractTxPowId, isTxConfirmed, TX_CONFIRMATION_TIMEOUT_MS, TX_POLL_INTERVAL_MS } from "../services/transactionStatus";
import { formatDisplayedAmount, getTokenSendableBalance } from "../services/walletPortfolio";

function resolveDexWsUrl() {
  if (typeof window === "undefined") {
    return "";
  }

  const explicitUrl = import.meta.env.VITE_DEX_WS_URL;
  if (explicitUrl) {
    return explicitUrl;
  }

  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) {
    const url = new URL(apiUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = "/dex";
    url.search = "";
    url.hash = "";
    return url.toString();
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const hostname = window.location.hostname;

  if (["localhost", "127.0.0.1"].includes(hostname)) {
    return `${protocol}//${hostname}:4000/dex`;
  }

  return `${protocol}//${window.location.host}/dex`;
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function extractTxData(result) {
  return (
    result?.data?.data ||
    result?.data ||
    result?.txndata ||
    result?.response?.data?.data ||
    result?.response?.txndata ||
    (typeof result === "string" ? result : "")
  );
}

async function waitForConfirmation(txpowid) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < TX_CONFIRMATION_TIMEOUT_MS) {
    const result = await MiniMask.checkTxPowAsync(txpowid);
    if (isTxConfirmed(result)) {
      return true;
    }

    await sleep(TX_POLL_INTERVAL_MS);
  }

  return false;
}

function buildTradeDetails(trade, walletAddress) {
  const isMaker = trade.makerWallet === walletAddress;
  const sendAmount = isMaker ? trade.makerSendsAmount : trade.takerSendsAmount;
  const sendToken = isMaker ? trade.makerSendsToken : trade.takerSendsToken;
  const receiveAmount = isMaker ? trade.makerReceivesAmount : trade.takerReceivesAmount;
  const receiveToken = isMaker ? trade.makerReceivesToken : trade.takerReceivesToken;

  return [
    { label: "Market", value: `${trade.baseToken}/${trade.quoteToken}` },
    { label: "Execution", value: `${trade.quantity} ${trade.baseToken} @ $${Number(trade.price).toFixed(4)}` },
    { label: "Send", value: `${formatDisplayedAmount(sendAmount)} ${sendToken}` },
    { label: "Receive", value: `${formatDisplayedAmount(receiveAmount)} ${receiveToken}` }
  ];
}

function getRequiredSpendForOrder(side, price, quantity) {
  const numericPrice = Number(price);
  const numericQuantity = Number(quantity);

  if (!Number.isFinite(numericPrice) || !Number.isFinite(numericQuantity)) {
    return 0;
  }

  return side === "bid"
    ? Number((numericPrice * numericQuantity).toFixed(8))
    : numericQuantity;
}

function formatTradeStatus(status) {
  switch (status) {
    case "awaiting_taker_signature":
      return "Awaiting taker signature";
    case "awaiting_maker_signature":
      return "Awaiting maker signature";
    case "submitted":
      return "Submitted on chain";
    case "confirmed":
      return "Confirmed";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

export function useDexOrderBook({
  address,
  fullBalance,
  marketPrices = {},
  publicKey,
  refreshWallet,
  sendableBalances = [],
  walletScript
}) {
  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const confirmedTradesRef = useRef(new Set());
  const [clientId, setClientId] = useState("");
  const [connectionState, setConnectionState] = useState("connecting");
  const [status, setStatus] = useState("Connecting to the live DEX relay.");
  const [error, setError] = useState("");
  const [orders, setOrders] = useState([]);
  const [trades, setTrades] = useState([]);
  const [orderForm, setOrderForm] = useState({
    baseToken: "MINIMA",
    price: "1.0000",
    quantity: "5",
    quoteToken: "USDT",
    side: "ask"
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [cancelLoadingId, setCancelLoadingId] = useState("");
  const [tradeLoadingId, setTradeLoadingId] = useState("");
  const [pendingTrade, setPendingTrade] = useState(null);
  const [incomingTrade, setIncomingTrade] = useState(null);

  const walletTokens = useMemo(
    () => normalizeDexBalances(fullBalance, sendableBalances),
    [fullBalance, sendableBalances]
  );

  const availableTokens = useMemo(() => {
    const registry = new Map(walletTokens.map((token) => [token.tokenId || token.symbol, token]));

    orders.forEach((order) => {
      const baseKey = order.baseTokenId || order.baseToken;
      if (!registry.has(baseKey)) {
        registry.set(baseKey, {
          amount: "0",
          coinlist: [],
          confirmed: "0",
          id: baseKey,
          sendable: "0",
          symbol: order.baseToken,
          tokenId: order.baseTokenId
        });
      }

      const quoteKey = order.quoteTokenId || order.quoteToken;
      if (!registry.has(quoteKey)) {
        registry.set(quoteKey, {
          amount: "0",
          coinlist: [],
          confirmed: "0",
          id: quoteKey,
          sendable: "0",
          symbol: order.quoteToken,
          tokenId: order.quoteTokenId
        });
      }
    });

    return Array.from(registry.values()).sort((left, right) => {
      const leftOwned = Number(left.sendable || 0) > 0 ? 1 : 0;
      const rightOwned = Number(right.sendable || 0) > 0 ? 1 : 0;

      if (leftOwned !== rightOwned) {
        return rightOwned - leftOwned;
      }

      return left.symbol.localeCompare(right.symbol);
    });
  }, [orders, walletTokens]);

  const baseToken = useMemo(
    () => resolveDexToken(availableTokens, orderForm.baseToken) || availableTokens[0] || null,
    [availableTokens, orderForm.baseToken]
  );
  const quoteToken = useMemo(() => {
    const preferred = resolveDexToken(availableTokens, orderForm.quoteToken);
    if (preferred && preferred.symbol !== baseToken?.symbol) {
      return preferred;
    }

    return availableTokens.find((token) => token.symbol !== baseToken?.symbol) || null;
  }, [availableTokens, baseToken?.symbol, orderForm.quoteToken]);

  const currentMarketKey = useMemo(
    () => getMarketKey(baseToken?.tokenId, quoteToken?.tokenId),
    [baseToken?.tokenId, quoteToken?.tokenId]
  );

  const liveOrders = useMemo(
    () =>
      orders.filter(
        (order) => order.marketKey === currentMarketKey && ["open", "partial"].includes(order.status)
      ),
    [currentMarketKey, orders]
  );
  const bids = useMemo(() => sortBookOrders(liveOrders, "bid"), [liveOrders]);
  const asks = useMemo(() => sortBookOrders(liveOrders, "ask"), [liveOrders]);
  const myOrders = useMemo(
    () =>
      orders
        .filter((order) => order.walletAddress === address)
        .sort((left, right) => right.updatedAt - left.updatedAt),
    [address, orders]
  );
  const myTrades = useMemo(
    () =>
      trades
        .filter((trade) => address && [trade.makerWallet, trade.takerWallet].includes(address))
        .sort((left, right) => right.updatedAt - left.updatedAt),
    [address, trades]
  );
  const bestBid = bids[0] || null;
  const bestAsk = asks[0] || null;
  const spread = useMemo(() => {
    if (!bestBid || !bestAsk) {
      return null;
    }

    return Number((Number(bestAsk.price) - Number(bestBid.price)).toFixed(4));
  }, [bestAsk, bestBid]);
  const totalBidDepth = useMemo(
    () => bids.reduce((sum, order) => sum + Number(order.remaining || 0), 0),
    [bids]
  );
  const totalAskDepth = useMemo(
    () => asks.reduce((sum, order) => sum + Number(order.remaining || 0), 0),
    [asks]
  );
  const bidLevels = useMemo(() => buildDepthLevels(liveOrders, "bid"), [liveOrders]);
  const askLevels = useMemo(() => buildDepthLevels(liveOrders, "ask"), [liveOrders]);
  const spendToken = useMemo(
    () => (orderForm.side === "bid" ? quoteToken?.symbol || "USDT" : baseToken?.symbol || "MINIMA"),
    [baseToken?.symbol, orderForm.side, quoteToken?.symbol]
  );
  const availableBalance = useMemo(
    () => getTokenSendableBalance(sendableBalances, spendToken),
    [sendableBalances, spendToken]
  );
  const requiredAmount = useMemo(() => {
    const numericPrice = Number(orderForm.price);
    const numericQuantity = Number(orderForm.quantity);

    if (!Number.isFinite(numericPrice) || !Number.isFinite(numericQuantity)) {
      return 0;
    }

    return getRequiredSpendForOrder(orderForm.side, numericPrice, numericQuantity);
  }, [orderForm.price, orderForm.quantity, orderForm.side]);
  const referencePrice = useMemo(() => {
    const basePrice = marketPrices?.[baseToken?.symbol];
    const quotePrice = marketPrices?.[quoteToken?.symbol];

    if (!Number.isFinite(Number(basePrice)) || !Number.isFinite(Number(quotePrice)) || !quotePrice) {
      return null;
    }

    return Number((Number(basePrice) / Number(quotePrice)).toFixed(4));
  }, [baseToken?.symbol, marketPrices, quoteToken?.symbol]);
  const marketSummaries = useMemo(() => {
    const grouped = new Map();

    orders
      .filter((order) => ["open", "partial"].includes(order.status))
      .forEach((order) => {
        const key = order.marketKey;
        const current = grouped.get(key) || {
          askPrice: null,
          baseToken: order.baseToken,
          bestBid: null,
          bestAsk: null,
          marketKey: key,
          quoteToken: order.quoteToken,
          totalAskDepth: 0,
          totalBidDepth: 0
        };

        if (order.side === "bid") {
          current.totalBidDepth += Number(order.remaining || 0);
          if (!current.bestBid || Number(order.price) > Number(current.bestBid)) {
            current.bestBid = Number(order.price);
          }
        } else {
          current.totalAskDepth += Number(order.remaining || 0);
          if (!current.bestAsk || Number(order.price) < Number(current.bestAsk)) {
            current.bestAsk = Number(order.price);
          }
        }

        grouped.set(key, current);
      });

    return Array.from(grouped.values());
  }, [orders]);

  const createDisabledReason = useMemo(() => {
    if (!address) {
      return "Connect MiniMask to place live DEX orders.";
    }

    if (!publicKey || !walletScript || !fullBalance) {
      return "Refresh MiniMask so the DEX can sync your live wallet snapshot.";
    }

    if (!baseToken || !quoteToken || baseToken.symbol === quoteToken.symbol) {
      return "Choose two different trade tokens.";
    }

    const numericPrice = Number(orderForm.price);
    const numericQuantity = Number(orderForm.quantity);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      return "Enter a valid limit price.";
    }

    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
      return "Enter a valid order quantity.";
    }

    if (requiredAmount > availableBalance) {
      return `Only ${formatDisplayedAmount(availableBalance)} ${spendToken} is spendable for this order.`;
    }

    return "";
  }, [
    address,
    availableBalance,
    baseToken,
    fullBalance,
    orderForm.price,
    orderForm.quantity,
    publicKey,
    quoteToken,
    requiredAmount,
    spendToken,
    walletScript
  ]);

  const aiContext = useMemo(
    () => ({
      availableTokens: availableTokens.map((token) => token.symbol),
      currentMarket: {
        baseToken: baseToken?.symbol || "MINIMA",
        quoteToken: quoteToken?.symbol || "USDT"
      },
      marketSummaries,
      totalAskDepth,
      totalBidDepth
    }),
    [availableTokens, baseToken?.symbol, marketSummaries, quoteToken?.symbol, totalAskDepth, totalBidDepth]
  );

  const sendRelayMessage = useCallback((type, payload = {}) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      throw new Error("DEX relay is not connected.");
    }

    socketRef.current.send(JSON.stringify({ type, payload }));
  }, []);

  useEffect(() => {
    const connect = () => {
      const wsUrl = resolveDexWsUrl();
      if (!wsUrl) {
        setConnectionState("offline");
        setStatus("DEX relay URL is not available.");
        return;
      }

      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;
      setConnectionState("connecting");

      socket.onopen = () => {
        setConnectionState("connected");
        setStatus("Live DEX relay connected.");

        socket.send(JSON.stringify({ type: "hello", payload: { walletAddress: address || "" } }));
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(String(event.data || "{}"));

          if (message.type === "connected") {
            setClientId(String(message?.payload?.clientId || ""));
            return;
          }

          if (message.type === "snapshot") {
            setOrders(message?.payload?.orders || []);
            setTrades(message?.payload?.trades || []);
            setError("");
            return;
          }

          if (message.type === "trade_created") {
            setPendingTrade(message?.payload?.trade || null);
            setStatus("A live counterparty was matched. Review the atomic trade before MiniMask signs it.");
            return;
          }

          if (message.type === "trade_request") {
            setIncomingTrade(message?.payload?.trade || null);
            setStatus("A counterparty sent an atomic trade for your order. Review and sign if valid.");
            return;
          }

          if (message.type === "trade_submitted") {
            const trade = message?.payload?.trade;
            if (trade?.txpowid) {
              setStatus(`Trade submitted on chain: ${trade.txpowid}`);
            }
            return;
          }

          if (message.type === "trade_confirmed") {
            const trade = message?.payload?.trade;
            if (trade?.txpowid) {
              setStatus(`Trade confirmed on chain: ${trade.txpowid}`);
            }
            return;
          }

          if (message.type === "trade_failed") {
            const trade = message?.payload?.trade;
            setStatus(trade?.errorMessage || "A DEX trade failed and the orderbook was restored.");
            setPendingTrade(null);
            setIncomingTrade(null);
            return;
          }

          if (message.type === "error") {
            const nextError = message?.payload?.message || "DEX relay error.";
            setError(nextError);
            setStatus(nextError);
          }
        } catch (currentError) {
          setError(currentError.message || "Unable to parse the live DEX relay payload.");
        }
      };

      socket.onclose = () => {
        setConnectionState("reconnecting");
        setStatus("DEX relay disconnected. Reconnecting...");
        reconnectTimerRef.current = window.setTimeout(connect, 2000);
      };

      socket.onerror = () => {
        setError("DEX relay connection failed.");
      };
    };

    connect();

    return () => {
      window.clearTimeout(reconnectTimerRef.current);

      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [address]);

  useEffect(() => {
    if (connectionState !== "connected" || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    socketRef.current.send(JSON.stringify({ type: "hello", payload: { walletAddress: address || "" } }));
  }, [address, connectionState]);

  useEffect(() => {
    if (
      connectionState !== "connected" ||
      !address ||
      !publicKey ||
      !walletScript ||
      !fullBalance ||
      !socketRef.current ||
      socketRef.current.readyState !== WebSocket.OPEN
    ) {
      return;
    }

    socketRef.current.send(
      JSON.stringify({
        type: "sync_wallet",
        payload: {
          balanceSnapshot: fullBalance,
          publicKey,
          script: walletScript,
          walletAddress: address
        }
      })
    );
  }, [address, connectionState, fullBalance, publicKey, walletScript]);

  useEffect(() => {
    if (!availableTokens.length) {
      return;
    }

    const nextBaseToken = baseToken?.symbol || availableTokens[0]?.symbol;
    const nextQuoteToken =
      quoteToken?.symbol ||
      availableTokens.find((token) => token.symbol !== nextBaseToken)?.symbol ||
      nextBaseToken;

    if (
      nextBaseToken !== orderForm.baseToken ||
      nextQuoteToken !== orderForm.quoteToken
    ) {
      setOrderForm((current) => ({
        ...current,
        baseToken: nextBaseToken,
        quoteToken: nextQuoteToken
      }));
    }
  }, [availableTokens, baseToken?.symbol, orderForm.baseToken, orderForm.quoteToken, quoteToken?.symbol]);

  useEffect(() => {
    const confirmedTrades = myTrades.filter((trade) => trade.status === "confirmed");
    if (!confirmedTrades.length || !refreshWallet) {
      return;
    }

    const hasNewConfirmation = confirmedTrades.some((trade) => !confirmedTradesRef.current.has(trade.id));
    if (!hasNewConfirmation) {
      return;
    }

    confirmedTrades.forEach((trade) => confirmedTradesRef.current.add(trade.id));
    void refreshWallet().catch(() => {
      // Wallet hook already surfaces sync issues elsewhere.
    });
  }, [myTrades, refreshWallet]);

  const setOrderField = useCallback((field, value) => {
    setOrderForm((current) => {
      const nextValue = String(value);
      const nextState = {
        ...current,
        [field]: nextValue
      };

      if (field === "baseToken" && nextValue === current.quoteToken) {
        const alternative = availableTokens.find((token) => token.symbol !== nextValue);
        nextState.quoteToken = alternative?.symbol || current.quoteToken;
      }

      if (field === "quoteToken" && nextValue === current.baseToken) {
        const alternative = availableTokens.find((token) => token.symbol !== nextValue);
        nextState.baseToken = alternative?.symbol || current.baseToken;
      }

      return nextState;
    });
  }, [availableTokens]);

  const createOrder = useCallback(async () => {
    if (createDisabledReason) {
      throw new Error(createDisabledReason);
    }

    setCreateLoading(true);
    setError("");

    try {
      sendRelayMessage("create_order", {
        baseToken: baseToken.symbol,
        baseTokenId: baseToken.tokenId,
        price: Number(orderForm.price),
        quantity: Number(orderForm.quantity),
        quoteToken: quoteToken.symbol,
        quoteTokenId: quoteToken.tokenId,
        side: orderForm.side
      });
      setStatus(`Placed a live ${orderForm.side === "bid" ? "BID" : "ASK"} order on the relay-backed book.`);
    } finally {
      setCreateLoading(false);
    }
  }, [baseToken, createDisabledReason, orderForm.price, orderForm.quantity, orderForm.side, quoteToken, sendRelayMessage]);

  const cancelOrder = useCallback(async (orderId) => {
    setCancelLoadingId(orderId);
    setError("");

    try {
      sendRelayMessage("cancel_order", { orderId });
      setStatus("Removed the live order from the book.");
    } finally {
      setCancelLoadingId("");
    }
  }, [sendRelayMessage]);

  const cancelAllOrders = useCallback(async () => {
    const openOrders = myOrders.filter((order) => ["open", "partial"].includes(order.status));
    if (!openOrders.length) {
      setStatus("There are no live orders to cancel.");
      return;
    }

    for (const order of openOrders) {
      sendRelayMessage("cancel_order", { orderId: order.id });
    }

    setStatus("Cancelling all of your open DEX orders.");
  }, [myOrders, sendRelayMessage]);

  const requestTakeOrder = useCallback(async (order, quantity) => {
    const numericQuantity = Number(quantity);
    const spendSymbol = order.side === "ask" ? order.quoteToken : order.baseToken;
    const spendable = getTokenSendableBalance(sendableBalances, spendSymbol);
    const required = getRequiredSpendForOrder(order.side === "ask" ? "bid" : "ask", order.price, numericQuantity);

    if (required > spendable) {
      const message = `Only ${formatDisplayedAmount(spendable)} ${spendSymbol} is available to take this order.`;
      setError(message);
      setStatus(message);
      throw new Error(message);
    }

    setError("");
    sendRelayMessage("take_order", {
      orderId: order.id,
      quantity: numericQuantity
    });
    setStatus("Requesting a live orderbook match.");
  }, [sendRelayMessage, sendableBalances]);

  const failTrade = useCallback((trade, errorMessage) => {
    if (!trade) {
      return;
    }

    sendRelayMessage("trade_progress", {
      errorMessage,
      stage: "failed",
      tradeId: trade.id
    });
  }, [sendRelayMessage]);

  const confirmPendingTrade = useCallback(async () => {
    if (!pendingTrade || !address || !walletScript || !fullBalance) {
      return;
    }

    setTradeLoadingId(pendingTrade.id);
    setError("");

    try {
      setStatus("Preparing the atomic trade in MiniMask.");
      const plan = buildAtomicTradePlan(pendingTrade, {
        address,
        balance: fullBalance,
        script: walletScript
      });
      const rawResult = await MiniMask.rawTxnAsync(plan.inputs, plan.outputs, plan.scripts, plan.state);
      const rawTxData = extractTxData(rawResult);
      if (!rawTxData) {
        throw new Error("MiniMask could not create the raw atomic trade.");
      }

      const signResult = await MiniMask.signAsync(rawTxData, false);
      const signedTxData = extractTxData(signResult);
      if (!signedTxData) {
        throw new Error("MiniMask did not return a signed trade payload.");
      }

      sendRelayMessage("trade_progress", {
        stage: "taker_signed",
        tradeId: pendingTrade.id,
        txndata: signedTxData
      });
      setPendingTrade(null);
      setStatus("Atomic trade sent to the maker for final signature and posting.");
    } catch (currentError) {
      const message = currentError.message || "Atomic trade preparation failed.";
      setError(message);
      setStatus(message);
      failTrade(pendingTrade, message);
      throw currentError;
    } finally {
      setTradeLoadingId("");
    }
  }, [address, failTrade, fullBalance, pendingTrade, sendRelayMessage, walletScript]);

  const confirmIncomingTrade = useCallback(async () => {
    if (!incomingTrade || !address) {
      return;
    }

    setTradeLoadingId(incomingTrade.id);
    setError("");

    try {
      setStatus("Validating the counterparty trade with MiniMask.");
      const viewResult = await MiniMask.viewTxnAsync(incomingTrade.txndata);
      validateIncomingTrade(incomingTrade, viewResult, address);

      const signResult = await MiniMask.signAsync(incomingTrade.txndata, true);
      const txpowid = extractTxPowId(signResult);
      if (!txpowid) {
        throw new Error("MiniMask did not return a txpowid for the posted trade.");
      }

      sendRelayMessage("trade_progress", {
        stage: "maker_submitted",
        tradeId: incomingTrade.id,
        txpowid
      });
      setIncomingTrade(null);
      setStatus("Atomic trade posted to Minima. Waiting for chain confirmation.");

      const confirmed = await waitForConfirmation(txpowid);
      sendRelayMessage("trade_progress", {
        stage: confirmed ? "confirmed" : "failed",
        tradeId: incomingTrade.id,
        txpowid,
        ...(confirmed ? {} : { errorMessage: "Trade confirmation timed out." })
      });

      if (confirmed) {
        setStatus(`Atomic trade confirmed on chain: ${txpowid}`);
        await refreshWallet?.();
      } else {
        setStatus("Trade was posted but chain confirmation timed out.");
      }
    } catch (currentError) {
      const message = currentError.message || "Counterparty trade validation failed.";
      setError(message);
      setStatus(message);
      failTrade(incomingTrade, message);
      throw currentError;
    } finally {
      setTradeLoadingId("");
    }
  }, [address, failTrade, incomingTrade, refreshWallet, sendRelayMessage]);

  const dismissPendingTrade = useCallback(() => {
    if (pendingTrade) {
      failTrade(pendingTrade, "Taker rejected the trade request.");
    }

    setPendingTrade(null);
  }, [failTrade, pendingTrade]);

  const dismissIncomingTrade = useCallback(() => {
    if (incomingTrade) {
      failTrade(incomingTrade, "Maker rejected the trade request.");
    }

    setIncomingTrade(null);
  }, [failTrade, incomingTrade]);

  const placeAiOrder = useCallback(async (draft) => {
    const nextBaseToken = resolveDexToken(availableTokens, draft.baseToken);
    const nextQuoteToken =
      resolveDexToken(availableTokens, draft.quoteToken) ||
      resolveDexToken(availableTokens, "USDT") ||
      availableTokens.find((token) => token.symbol !== nextBaseToken?.symbol);

    if (!nextBaseToken || !nextQuoteToken) {
      throw new Error("The requested token pair is not available in the live DEX.");
    }

    const marketKey = getMarketKey(nextBaseToken.tokenId, nextQuoteToken.tokenId);
    const marketOrders = orders.filter(
      (order) => order.marketKey === marketKey && ["open", "partial"].includes(order.status)
    );
    const marketBids = sortBookOrders(marketOrders, "bid");
    const marketAsks = sortBookOrders(marketOrders, "ask");
    const side = draft.side === "buy" ? "bid" : "ask";
    const quantity = String(draft.quantity);
    const orderPrice =
      draft.price ||
      estimatePriceForFill(side === "bid" ? marketAsks : marketBids, quantity, side)?.price;

    if (!orderPrice) {
      throw new Error(
        side === "bid"
          ? `No ask liquidity is live for ${nextBaseToken.symbol}/${nextQuoteToken.symbol}.`
          : `No bid liquidity is live for ${nextBaseToken.symbol}/${nextQuoteToken.symbol}.`
      );
    }

    const spendSymbol = side === "bid" ? nextQuoteToken.symbol : nextBaseToken.symbol;
    const spendable = getTokenSendableBalance(sendableBalances, spendSymbol);
    const required = getRequiredSpendForOrder(side, orderPrice, quantity);

    if (required > spendable) {
      const message = `Only ${formatDisplayedAmount(spendable)} ${spendSymbol} is spendable for that order.`;
      setError(message);
      setStatus(message);
      throw new Error(message);
    }

    setOrderForm((current) => ({
      ...current,
      baseToken: nextBaseToken.symbol,
      price: String(orderPrice),
      quantity,
      quoteToken: nextQuoteToken.symbol,
      side
    }));

    sendRelayMessage("create_order", {
      baseToken: nextBaseToken.symbol,
      baseTokenId: nextBaseToken.tokenId,
      price: Number(orderPrice),
      quantity: Number(quantity),
      quoteToken: nextQuoteToken.symbol,
      quoteTokenId: nextQuoteToken.tokenId,
      side
    });

    setStatus(
      `Placing a live ${side === "bid" ? "BUY" : "SELL"} order for ${quantity} ${nextBaseToken.symbol} on ${nextBaseToken.symbol}/${nextQuoteToken.symbol}.`
    );
  }, [availableTokens, orders, sendRelayMessage, sendableBalances]);

  return {
    aiContext,
    askLevels,
    asks,
    availableBalance,
    availableTokens,
    bestAsk,
    bestBid,
    bidLevels,
    bids,
    cancelAllOrders,
    cancelLoadingId,
    cancelOrder,
    clientId,
    confirmIncomingTrade,
    confirmPendingTrade,
    connectionState,
    createDisabledReason,
    createLoading,
    createOrder,
    currentMarket: {
      baseToken: baseToken?.symbol || "MINIMA",
      quoteToken: quoteToken?.symbol || "USDT"
    },
    dismissIncomingTrade,
    dismissPendingTrade,
    error,
    formatTradeStatus,
    incomingTrade,
    marketSummaries,
    myOrders,
    myTrades,
    orderForm,
    pendingTrade,
    placeAiOrder,
    quoteTokenOptions: availableTokens.filter((token) => token.symbol !== baseToken?.symbol),
    referencePrice,
    requestTakeOrder,
    requiredAmount,
    setOrderField,
    spendToken,
    spread,
    status,
    totalAskDepth,
    totalBidDepth,
    incomingTradeDetails: incomingTrade ? buildTradeDetails(incomingTrade, address) : [],
    tradeDetails: pendingTrade ? buildTradeDetails(pendingTrade, address) : [],
    tradeLoadingId,
    walletAddress: address
  };
}
