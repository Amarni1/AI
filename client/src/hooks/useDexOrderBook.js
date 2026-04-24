import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MiniMask } from "../services/minimask";
import { getTokenId } from "../services/swapEngine";
import {
  extractTxPowId,
  isTxConfirmed,
  TX_CONFIRMATION_TIMEOUT_MS,
  TX_POLL_INTERVAL_MS
} from "../services/transactionStatus";
import {
  formatDisplayedAmount,
  getTokenSendableBalance
} from "../services/walletPortfolio";

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

function getOrderSellToken(side) {
  return side === "bid" ? "USDT" : "MINIMA";
}

function getOrderRequiredAmount(side, price, quantity) {
  const numericPrice = Number(price);
  const numericQuantity = Number(quantity);

  if (!Number.isFinite(numericPrice) || !Number.isFinite(numericQuantity)) {
    return 0;
  }

  return side === "bid" ? Number((numericPrice * numericQuantity).toFixed(4)) : numericQuantity;
}

function sortOrderBook(orders, side) {
  const sorted = [...orders]
    .filter((order) => order.side === side)
    .sort((left, right) => {
      if (side === "bid") {
        return right.price - left.price || left.createdAt - right.createdAt;
      }

      return left.price - right.price || left.createdAt - right.createdAt;
    });

  return sorted;
}

function getTradeRole(trade, walletAddress) {
  if (!walletAddress) {
    return "";
  }

  if (trade.takerWallet === walletAddress) {
    return "taker";
  }

  if (trade.makerWallet === walletAddress) {
    return "maker";
  }

  return "";
}

function getSettlementDraft(trade, walletAddress) {
  const role = getTradeRole(trade, walletAddress);

  if (role === "taker") {
    return {
      amount: trade.takerSendsAmount,
      recipient: trade.makerWallet,
      role,
      token: trade.takerSendsToken
    };
  }

  if (role === "maker") {
    return {
      amount: trade.makerSendsAmount,
      recipient: trade.takerWallet,
      role,
      token: trade.makerSendsToken
    };
  }

  return null;
}

async function waitForConfirmation(txpowid) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < TX_CONFIRMATION_TIMEOUT_MS) {
    const result = await MiniMask.checkTxPowAsync(txpowid);
    if (isTxConfirmed(result)) {
      return true;
    }

    await new Promise((resolve) => window.setTimeout(resolve, TX_POLL_INTERVAL_MS));
  }

  return false;
}

export function useDexOrderBook({
  address,
  send,
  sendableBalances = []
}) {
  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const pendingTakeRef = useRef(null);
  const [connectionState, setConnectionState] = useState("connecting");
  const [status, setStatus] = useState("Connecting to the live DEX relay.");
  const [error, setError] = useState("");
  const [orders, setOrders] = useState([]);
  const [trades, setTrades] = useState([]);
  const [orderForm, setOrderForm] = useState({
    price: "1.00",
    quantity: "5",
    side: "ask"
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [cancelLoadingId, setCancelLoadingId] = useState("");
  const [settlementLoadingId, setSettlementLoadingId] = useState("");

  const liveOrders = useMemo(
    () => orders.filter((order) => ["open", "partial", "filled"].includes(order.status)),
    [orders]
  );
  const bids = useMemo(() => sortOrderBook(liveOrders, "bid"), [liveOrders]);
  const asks = useMemo(() => sortOrderBook(liveOrders, "ask"), [liveOrders]);
  const myOrders = useMemo(
    () => orders.filter((order) => address && order.walletAddress === address),
    [address, orders]
  );
  const myTrades = useMemo(
    () => trades.filter((trade) => address && [trade.makerWallet, trade.takerWallet].includes(address)),
    [address, trades]
  );
  const bestBid = bids[0] || null;
  const bestAsk = asks[0] || null;
  const spread = useMemo(() => {
    if (!bestBid || !bestAsk) {
      return null;
    }

    return Number((bestAsk.price - bestBid.price).toFixed(4));
  }, [bestAsk, bestBid]);
  const totalBidDepth = useMemo(
    () => bids.reduce((sum, order) => sum + Number(order.remaining || 0), 0),
    [bids]
  );
  const totalAskDepth = useMemo(
    () => asks.reduce((sum, order) => sum + Number(order.remaining || 0), 0),
    [asks]
  );
  const sellToken = useMemo(() => getOrderSellToken(orderForm.side), [orderForm.side]);
  const availableBalance = useMemo(
    () => getTokenSendableBalance(sendableBalances, sellToken),
    [sellToken, sendableBalances]
  );
  const requiredAmount = useMemo(
    () => getOrderRequiredAmount(orderForm.side, orderForm.price, orderForm.quantity),
    [orderForm.price, orderForm.quantity, orderForm.side]
  );
  const createDisabledReason = useMemo(() => {
    if (!address) {
      return "Connect MiniMask to place orders.";
    }

    const numericPrice = Number(orderForm.price);
    const numericQuantity = Number(orderForm.quantity);

    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      return "Enter a valid price.";
    }

    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
      return "Enter a valid quantity.";
    }

    if (requiredAmount > availableBalance) {
      return `Only ${formatDisplayedAmount(availableBalance)} ${sellToken} is available for this order.`;
    }

    return "";
  }, [address, availableBalance, orderForm.price, orderForm.quantity, requiredAmount, sellToken]);

  const sendRelayMessage = useCallback((type, payload = {}) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      throw new Error("DEX relay is not connected.");
    }

    socketRef.current.send(
      JSON.stringify({
        type,
        payload
      })
    );
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

        if (address) {
          socket.send(
            JSON.stringify({
              type: "hello",
              payload: { walletAddress: address }
            })
          );
        }
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(String(event.data || "{}"));

          if (message.type === "snapshot") {
            setOrders(message?.payload?.orders || []);
            setTrades(message?.payload?.trades || []);
            setError("");
            return;
          }

          if (message.type === "trade_created") {
            pendingTakeRef.current?.resolve?.(message.payload.trade);
            pendingTakeRef.current = null;
            return;
          }

          if (message.type === "error") {
            const nextError = message?.payload?.message || "DEX relay error.";
            setError(nextError);
            setStatus(nextError);
            pendingTakeRef.current?.reject?.(new Error(nextError));
            pendingTakeRef.current = null;
          }
        } catch (currentError) {
          setError(currentError.message || "Unable to parse DEX relay message.");
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
      pendingTakeRef.current = null;

      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (connectionState !== "connected" || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    socketRef.current.send(
      JSON.stringify({
        type: "hello",
        payload: { walletAddress: address || "" }
      })
    );
  }, [address, connectionState]);

  const setOrderField = useCallback((field, value) => {
    setOrderForm((current) => ({
      ...current,
      [field]: value
    }));
  }, []);

  const createOrder = useCallback(async () => {
    if (createDisabledReason) {
      throw new Error(createDisabledReason);
    }

    setCreateLoading(true);
    setError("");

    try {
      sendRelayMessage("create_order", {
        baseToken: "MINIMA",
        price: Number(orderForm.price),
        quantity: Number(orderForm.quantity),
        quoteToken: "USDT",
        side: orderForm.side,
        walletAddress: address
      });
      setStatus(`Placed a ${orderForm.side.toUpperCase()} order on the live book.`);
    } finally {
      setCreateLoading(false);
    }
  }, [address, createDisabledReason, orderForm.price, orderForm.quantity, orderForm.side, sendRelayMessage]);

  const cancelOrder = useCallback(async (orderId) => {
    setCancelLoadingId(orderId);
    setError("");

    try {
      sendRelayMessage("cancel_order", {
        orderId,
        walletAddress: address
      });
      setStatus("Order cancelled.");
    } finally {
      setCancelLoadingId("");
    }
  }, [address, sendRelayMessage]);

  const requestTakeOrder = useCallback(async (order, quantity) => {
    if (!address) {
      throw new Error("Connect MiniMask to take orders.");
    }

    const numericQuantity = Number(quantity);
    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
      throw new Error("Enter a valid fill quantity.");
    }

    const settlementPreview = deriveTakePreview(order, numericQuantity, address, sendableBalances);
    if (settlementPreview.disabledReason) {
      throw new Error(settlementPreview.disabledReason);
    }

    const trade = await new Promise((resolve, reject) => {
      pendingTakeRef.current = { reject, resolve };

      sendRelayMessage("take_order", {
        orderId: order.id,
        quantity: numericQuantity,
        walletAddress: address
      });

      window.setTimeout(() => {
        if (pendingTakeRef.current) {
          pendingTakeRef.current.reject(new Error("Timed out waiting for trade allocation."));
          pendingTakeRef.current = null;
        }
      }, 4000);
    });

    setStatus("Trade matched. Confirm MiniMask settlement to continue.");
    return trade;
  }, [address, sendRelayMessage, sendableBalances]);

  const settleTrade = useCallback(async (trade) => {
    const draft = getSettlementDraft(trade, address);

    if (!draft) {
      throw new Error("This wallet is not a participant in the selected trade.");
    }

    const available = getTokenSendableBalance(sendableBalances, draft.token);
    const numericAmount = Number(draft.amount);

    if (numericAmount > 0 && numericAmount > available) {
      throw new Error(`Only ${formatDisplayedAmount(available)} ${draft.token} is sendable.`);
    }

    setSettlementLoadingId(trade.id);
    setError("");
    setStatus(`Opening MiniMask to settle ${draft.amount} ${draft.token}.`);

    try {
      const state = {
        0: "DEX_FILL",
        1: trade.orderId,
        2: trade.id,
        3: draft.role.toUpperCase(),
        4: trade.baseToken,
        5: trade.quoteToken,
        6: draft.amount,
        7: String(trade.price)
      };

      const sendResult = await send(draft.amount, draft.recipient, {
        state,
        tokenid: getTokenId(draft.token) || "0x00"
      });

      const txpowid = extractTxPowId(sendResult);
      if (!txpowid) {
        throw new Error("MiniMask did not return a transaction id.");
      }

      sendRelayMessage("trade_progress", {
        stage: draft.role === "taker" ? "taker_submitted" : "maker_submitted",
        tradeId: trade.id,
        txpowid,
        walletAddress: address
      });

      const confirmed = await waitForConfirmation(txpowid);
      if (!confirmed) {
        throw new Error("Timed out waiting for DEX settlement confirmation.");
      }

      sendRelayMessage("trade_progress", {
        stage: draft.role === "taker" ? "taker_confirmed" : "completed",
        tradeId: trade.id,
        txpowid,
        walletAddress: address
      });

      setStatus(
        draft.role === "taker"
          ? "Taker settlement confirmed. Waiting for maker counter-settlement."
          : "Maker settlement confirmed. Trade completed."
      );

      return txpowid;
    } catch (currentError) {
      sendRelayMessage("trade_progress", {
        errorMessage: currentError.message || "Settlement failed.",
        stage: "failed",
        tradeId: trade.id,
        walletAddress: address
      });
      setStatus(currentError.message || "DEX settlement failed.");
      throw currentError;
    } finally {
      setSettlementLoadingId("");
    }
  }, [address, send, sendRelayMessage, sendableBalances]);

  return {
    asks,
    bestAsk,
    bestBid,
    cancelLoadingId,
    cancelOrder,
    connectionState,
    createDisabledReason,
    createLoading,
    createOrder,
    error,
    myOrders,
    myTrades,
    orderForm,
    orders: liveOrders,
    requestTakeOrder,
    requiredAmount,
    sellToken,
    setOrderField,
    settlementLoadingId,
    settleTrade,
    spread,
    status,
    totalAskDepth,
    totalBidDepth,
    trades,
    availableBalance,
    bids
  };
}

function deriveTakePreview(order, quantity, walletAddress, sendableBalances) {
  const terms = getSettlementDraft(
    {
      ...order,
      makerWallet: order.walletAddress,
      takerWallet: walletAddress,
      ...(
        order.side === "ask"
          ? {
              makerReceivesAmount: String(Number((quantity * order.price).toFixed(4))),
              makerReceivesToken: "USDT",
              makerSendsAmount: String(quantity),
              makerSendsToken: "MINIMA",
              takerReceivesAmount: String(quantity),
              takerReceivesToken: "MINIMA",
              takerSendsAmount: String(Number((quantity * order.price).toFixed(4))),
              takerSendsToken: "USDT"
            }
          : {
              makerReceivesAmount: String(quantity),
              makerReceivesToken: "MINIMA",
              makerSendsAmount: String(Number((quantity * order.price).toFixed(4))),
              makerSendsToken: "USDT",
              takerReceivesAmount: String(Number((quantity * order.price).toFixed(4))),
              takerReceivesToken: "USDT",
              takerSendsAmount: String(quantity),
              takerSendsToken: "MINIMA"
            }
      )
    },
    walletAddress
  );

  const available = getTokenSendableBalance(sendableBalances, terms?.token);
  if (Number(terms?.amount || 0) > 0 && Number(terms?.amount || 0) > available) {
    return {
      disabledReason: `Only ${formatDisplayedAmount(available)} ${terms.token} is sendable for this fill.`
    };
  }

  return { disabledReason: "" };
}
