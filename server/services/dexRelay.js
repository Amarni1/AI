import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";

const MAX_SNAPSHOT_ORDERS = 240;
const MAX_SNAPSHOT_TRADES = 240;

function sendMessage(socket, type, payload = {}) {
  if (socket.readyState !== 1) {
    return;
  }

  socket.send(JSON.stringify({ type, payload }));
}

function trimCollection(map, maxItems) {
  const values = Array.from(map.values());
  if (values.length <= maxItems) {
    return;
  }

  values
    .sort((left, right) => left.updatedAt - right.updatedAt)
    .slice(0, values.length - maxItems)
    .forEach((entry) => {
      map.delete(entry.id);
    });
}

function createSnapshot(orders, trades) {
  trimCollection(orders, MAX_SNAPSHOT_ORDERS);
  trimCollection(trades, MAX_SNAPSHOT_TRADES);

  return {
    orders: Array.from(orders.values()).sort((left, right) => right.updatedAt - left.updatedAt),
    timestamp: Date.now(),
    trades: Array.from(trades.values()).sort((left, right) => right.updatedAt - left.updatedAt)
  };
}

function broadcastSnapshot(clients, orders, trades) {
  const snapshot = JSON.stringify({
    type: "snapshot",
    payload: createSnapshot(orders, trades)
  });

  clients.forEach((client) => {
    if (client.socket.readyState === 1) {
      client.socket.send(snapshot);
    }
  });
}

function getCounterpartyOrders(orders, order) {
  return Array.from(orders.values())
    .filter((candidate) => {
      if (!["open", "partial"].includes(candidate.status)) {
        return false;
      }

      if (candidate.id === order.id) {
        return false;
      }

      if (candidate.clientId === order.clientId) {
        return false;
      }

      if (candidate.marketKey !== order.marketKey) {
        return false;
      }

      if (candidate.side === order.side) {
        return false;
      }

      if (order.side === "bid") {
        return Number(candidate.price) <= Number(order.price);
      }

      return Number(candidate.price) >= Number(order.price);
    })
    .sort((left, right) => {
      if (order.side === "bid") {
        return left.price - right.price || left.createdAt - right.createdAt;
      }

      return right.price - left.price || left.createdAt - right.createdAt;
    });
}

function reserveOrder(order, quantity) {
  const remaining = Math.max(0, Number(Number(order.remaining) - Number(quantity)).toFixed(8));

  return {
    ...order,
    remaining: String(remaining),
    status: remaining > 0
      ? remaining < Number(order.quantity)
        ? "partial"
        : "open"
      : "filled",
    updatedAt: Date.now()
  };
}

function restoreOrder(order, quantity) {
  const restored = Math.min(
    Number(order.quantity),
    Number((Number(order.remaining) + Number(quantity)).toFixed(8))
  );

  return {
    ...order,
    remaining: String(restored),
    status: restored < Number(order.quantity) ? "partial" : "open",
    updatedAt: Date.now()
  };
}

function deriveTradeTerms(order, quantity) {
  const tradeQuantity = Number(quantity);
  const notional = Number((tradeQuantity * Number(order.price)).toFixed(8));

  if (order.side === "ask") {
    return {
      makerReceivesAmount: String(notional),
      makerReceivesToken: order.quoteToken,
      makerReceivesTokenId: order.quoteTokenId,
      makerSendsAmount: String(tradeQuantity),
      makerSendsToken: order.baseToken,
      makerSendsTokenId: order.baseTokenId,
      takerReceivesAmount: String(tradeQuantity),
      takerReceivesToken: order.baseToken,
      takerReceivesTokenId: order.baseTokenId,
      takerSendsAmount: String(notional),
      takerSendsToken: order.quoteToken,
      takerSendsTokenId: order.quoteTokenId
    };
  }

  return {
    makerReceivesAmount: String(tradeQuantity),
    makerReceivesToken: order.baseToken,
    makerReceivesTokenId: order.baseTokenId,
    makerSendsAmount: String(notional),
    makerSendsToken: order.quoteToken,
    makerSendsTokenId: order.quoteTokenId,
    takerReceivesAmount: String(notional),
    takerReceivesToken: order.quoteToken,
    takerReceivesTokenId: order.quoteTokenId,
    takerSendsAmount: String(tradeQuantity),
    takerSendsToken: order.baseToken,
    takerSendsTokenId: order.baseTokenId
  };
}

function buildTrade(order, takerClient, quantity, options = {}) {
  return {
    id: randomUUID(),
    baseToken: order.baseToken,
    baseTokenId: order.baseTokenId,
    createdAt: Date.now(),
    makerBalance: order.balanceSnapshot || null,
    makerClientId: order.clientId,
    makerOrderId: order.id,
    makerPublicKey: order.publicKey || "",
    makerScript: order.script || "",
    makerWallet: order.walletAddress,
    marketKey: order.marketKey,
    orderId: order.id,
    orderSide: order.side,
    price: Number(order.price),
    quantity: String(quantity),
    quoteToken: order.quoteToken,
    quoteTokenId: order.quoteTokenId,
    status: "awaiting_taker_signature",
    takerBalance: takerClient.balanceSnapshot || null,
    takerClientId: takerClient.id,
    takerOrderId: options.takerOrderId || "",
    takerPublicKey: takerClient.publicKey || "",
    takerScript: takerClient.script || "",
    takerWallet: takerClient.walletAddress,
    updatedAt: Date.now(),
    ...deriveTradeTerms(order, quantity)
  };
}

function createMatchedTrade(order, takerClient, quantity, orders, trades, options = {}) {
  const makerOrder = reserveOrder(order, quantity);
  orders.set(order.id, makerOrder);

  if (options.takerOrderId) {
    const takerOrder = orders.get(options.takerOrderId);
    if (takerOrder) {
      orders.set(options.takerOrderId, reserveOrder(takerOrder, quantity));
    }
  }

  const trade = buildTrade(makerOrder, takerClient, quantity, options);
  trades.set(trade.id, trade);
  return trade;
}

function cancelClientOrders(clientId, orders) {
  let changed = false;

  orders.forEach((order, orderId) => {
    if (order.clientId !== clientId || !["open", "partial"].includes(order.status)) {
      return;
    }

    changed = true;
    orders.set(orderId, {
      ...order,
      status: "cancelled",
      updatedAt: Date.now()
    });
  });

  return changed;
}

export function attachDexRelay(server) {
  const wss = new WebSocketServer({ server, path: "/dex" });
  const clients = new Map();
  const orders = new Map();
  const trades = new Map();

  wss.on("connection", (socket) => {
    const clientId = randomUUID();
    clients.set(clientId, {
      balanceSnapshot: null,
      id: clientId,
      publicKey: "",
      script: "",
      socket,
      walletAddress: ""
    });

    sendMessage(socket, "connected", { clientId });
    sendMessage(socket, "snapshot", createSnapshot(orders, trades));

    socket.on("message", (rawMessage) => {
      try {
        const message = JSON.parse(String(rawMessage || "{}"));
        const client = clients.get(clientId);

        if (!client) {
          return;
        }

        if (message.type === "hello") {
          client.walletAddress = String(message?.payload?.walletAddress || "").trim();
          sendMessage(socket, "hello_ack", { walletAddress: client.walletAddress });
          broadcastSnapshot(clients, orders, trades);
          return;
        }

        if (message.type === "sync_wallet") {
          client.balanceSnapshot = message?.payload?.balanceSnapshot || null;
          client.publicKey = String(message?.payload?.publicKey || "").trim();
          client.script = String(message?.payload?.script || "").trim();
          client.walletAddress =
            String(message?.payload?.walletAddress || client.walletAddress || "").trim();

          orders.forEach((order, orderId) => {
            if (order.clientId !== client.id || !["open", "partial"].includes(order.status)) {
              return;
            }

            orders.set(orderId, {
              ...order,
              balanceSnapshot: client.balanceSnapshot,
              publicKey: client.publicKey,
              script: client.script,
              updatedAt: Date.now(),
              walletAddress: client.walletAddress
            });
          });

          broadcastSnapshot(clients, orders, trades);
          return;
        }

        if (message.type === "create_order") {
          if (!client.walletAddress || !client.script || !client.balanceSnapshot) {
            sendMessage(socket, "error", {
              message: "Refresh your MiniMask wallet before placing a live DEX order."
            });
            return;
          }

          const side = message?.payload?.side === "bid" ? "bid" : "ask";
          const baseToken = String(message?.payload?.baseToken || "").trim().toUpperCase();
          const baseTokenId = String(message?.payload?.baseTokenId || "").trim();
          const quoteToken = String(message?.payload?.quoteToken || "").trim().toUpperCase();
          const quoteTokenId = String(message?.payload?.quoteTokenId || "").trim();
          const price = Number(message?.payload?.price);
          const quantity = Number(message?.payload?.quantity);

          if (!baseToken || !baseTokenId || !quoteToken || !quoteTokenId) {
            sendMessage(socket, "error", { message: "Token metadata is missing for this order." });
            return;
          }

          if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(quantity) || quantity <= 0) {
            sendMessage(socket, "error", { message: "Invalid order request." });
            return;
          }

          const orderId = randomUUID();
          const order = {
            balanceSnapshot: client.balanceSnapshot,
            baseToken,
            baseTokenId,
            clientId: client.id,
            createdAt: Date.now(),
            id: orderId,
            marketKey: `${baseTokenId}::${quoteTokenId}`,
            price: Number(price.toFixed(8)),
            publicKey: client.publicKey,
            quantity: String(quantity),
            quoteToken,
            quoteTokenId,
            remaining: String(quantity),
            script: client.script,
            side,
            status: "open",
            updatedAt: Date.now(),
            walletAddress: client.walletAddress
          };

          orders.set(orderId, order);
          sendMessage(socket, "order_created", { orderId });

          const match = getCounterpartyOrders(orders, order)[0];
          if (match) {
            const tradeQuantity = Math.min(Number(order.remaining), Number(match.remaining));
            const trade = createMatchedTrade(match, client, tradeQuantity, orders, trades, {
              takerOrderId: order.id
            });
            sendMessage(socket, "trade_created", { trade });
          }

          broadcastSnapshot(clients, orders, trades);
          return;
        }

        if (message.type === "cancel_order") {
          const orderId = String(message?.payload?.orderId || "");
          const order = orders.get(orderId);

          if (!order || order.clientId !== client.id || !["open", "partial"].includes(order.status)) {
            sendMessage(socket, "error", { message: "Order could not be cancelled." });
            return;
          }

          orders.set(orderId, {
            ...order,
            status: "cancelled",
            updatedAt: Date.now()
          });
          sendMessage(socket, "order_cancelled", { orderId });
          broadcastSnapshot(clients, orders, trades);
          return;
        }

        if (message.type === "take_order") {
          if (!client.walletAddress || !client.script || !client.balanceSnapshot) {
            sendMessage(socket, "error", {
              message: "Refresh your MiniMask wallet before taking a live order."
            });
            return;
          }

          const orderId = String(message?.payload?.orderId || "");
          const quantity = Number(message?.payload?.quantity);
          const order = orders.get(orderId);

          if (!order || !["open", "partial"].includes(order.status)) {
            sendMessage(socket, "error", { message: "Order is no longer available." });
            return;
          }

          if (order.clientId === client.id) {
            sendMessage(socket, "error", { message: "You cannot take your own order." });
            return;
          }

          if (!Number.isFinite(quantity) || quantity <= 0 || quantity > Number(order.remaining)) {
            sendMessage(socket, "error", { message: "Invalid fill quantity." });
            return;
          }

          const trade = createMatchedTrade(order, client, quantity, orders, trades);
          sendMessage(socket, "trade_created", { trade });
          broadcastSnapshot(clients, orders, trades);
          return;
        }

        if (message.type === "trade_progress") {
          const tradeId = String(message?.payload?.tradeId || "");
          const stage = String(message?.payload?.stage || "").trim();
          const trade = trades.get(tradeId);

          if (!trade) {
            sendMessage(socket, "error", { message: "Trade could not be updated." });
            return;
          }

          const isMaker = trade.makerClientId === client.id;
          const isTaker = trade.takerClientId === client.id;

          if (!isMaker && !isTaker) {
            sendMessage(socket, "error", { message: "Trade update rejected." });
            return;
          }

          const nextTrade = {
            ...trade,
            updatedAt: Date.now()
          };

          if (stage === "taker_signed") {
            if (!isTaker) {
              sendMessage(socket, "error", { message: "Only the taker can initiate this trade." });
              return;
            }

            nextTrade.status = "awaiting_maker_signature";
            nextTrade.txndata = String(message?.payload?.txndata || "");
            trades.set(tradeId, nextTrade);

            const makerClient = clients.get(nextTrade.makerClientId);
            if (makerClient) {
              sendMessage(makerClient.socket, "trade_request", { trade: nextTrade });
            }
          } else if (stage === "maker_submitted") {
            if (!isMaker) {
              sendMessage(socket, "error", { message: "Only the maker can post this trade." });
              return;
            }

            nextTrade.status = "submitted";
            nextTrade.txpowid = String(message?.payload?.txpowid || "");
            trades.set(tradeId, nextTrade);

            const takerClient = clients.get(nextTrade.takerClientId);
            if (takerClient) {
              sendMessage(takerClient.socket, "trade_submitted", { trade: nextTrade });
            }
          } else if (stage === "confirmed") {
            nextTrade.status = "confirmed";
            nextTrade.txpowid = String(message?.payload?.txpowid || nextTrade.txpowid || "");
            trades.set(tradeId, nextTrade);

            const makerClient = clients.get(nextTrade.makerClientId);
            const takerClient = clients.get(nextTrade.takerClientId);
            if (makerClient) {
              sendMessage(makerClient.socket, "trade_confirmed", { trade: nextTrade });
            }
            if (takerClient) {
              sendMessage(takerClient.socket, "trade_confirmed", { trade: nextTrade });
            }
          } else if (stage === "failed") {
            nextTrade.status = "failed";
            nextTrade.errorMessage = String(message?.payload?.errorMessage || "Atomic trade failed.");
            trades.set(tradeId, nextTrade);

            const makerOrder = orders.get(nextTrade.makerOrderId);
            if (makerOrder && makerOrder.status !== "cancelled") {
              orders.set(nextTrade.makerOrderId, restoreOrder(makerOrder, nextTrade.quantity));
            }

            if (nextTrade.takerOrderId) {
              const takerOrder = orders.get(nextTrade.takerOrderId);
              if (takerOrder && takerOrder.status !== "cancelled") {
                orders.set(nextTrade.takerOrderId, restoreOrder(takerOrder, nextTrade.quantity));
              }
            }

            const makerClient = clients.get(nextTrade.makerClientId);
            const takerClient = clients.get(nextTrade.takerClientId);
            if (makerClient) {
              sendMessage(makerClient.socket, "trade_failed", { trade: nextTrade });
            }
            if (takerClient) {
              sendMessage(takerClient.socket, "trade_failed", { trade: nextTrade });
            }
          } else {
            sendMessage(socket, "error", { message: "Unknown trade stage." });
            return;
          }

          broadcastSnapshot(clients, orders, trades);
          return;
        }

        if (message.type === "refresh") {
          sendMessage(socket, "snapshot", createSnapshot(orders, trades));
          return;
        }
      } catch (error) {
        sendMessage(socket, "error", {
          message: error.message || "DEX relay message failed."
        });
      }
    });

    socket.on("close", () => {
      clients.delete(clientId);

      if (cancelClientOrders(clientId, orders)) {
        broadcastSnapshot(clients, orders, trades);
      }
    });
  });

  return wss;
}
