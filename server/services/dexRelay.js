import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";

function createSnapshot(orders, trades) {
  return {
    orders: Array.from(orders.values())
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, 120),
    trades: Array.from(trades.values())
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, 120),
    timestamp: Date.now()
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

function sendMessage(socket, type, payload = {}) {
  if (socket.readyState !== 1) {
    return;
  }

  socket.send(
    JSON.stringify({
      type,
      payload
    })
  );
}

function deriveTradeTerms(order, quantity) {
  const numericQuantity = Number(quantity);
  const notional = Number((numericQuantity * order.price).toFixed(4));

  if (order.side === "ask") {
    return {
      makerReceivesAmount: String(notional),
      makerReceivesToken: order.quoteToken,
      makerSendsAmount: String(numericQuantity),
      makerSendsToken: order.baseToken,
      takerReceivesAmount: String(numericQuantity),
      takerReceivesToken: order.baseToken,
      takerSendsAmount: String(notional),
      takerSendsToken: order.quoteToken
    };
  }

  return {
    makerReceivesAmount: String(numericQuantity),
    makerReceivesToken: order.baseToken,
    makerSendsAmount: String(notional),
    makerSendsToken: order.quoteToken,
    takerReceivesAmount: String(notional),
    takerReceivesToken: order.quoteToken,
    takerSendsAmount: String(numericQuantity),
    takerSendsToken: order.baseToken
  };
}

function restoreOrder(order, tradeQuantity) {
  const restoredRemaining = Number(order.remaining) + Number(tradeQuantity);
  const cappedRemaining = Math.min(Number(order.quantity), restoredRemaining);

  return {
    ...order,
    remaining: String(cappedRemaining),
    status: cappedRemaining < Number(order.quantity) ? "partial" : "open",
    updatedAt: Date.now()
  };
}

export function attachDexRelay(server) {
  const wss = new WebSocketServer({ server, path: "/dex" });
  const clients = new Map();
  const orders = new Map();
  const trades = new Map();

  wss.on("connection", (socket) => {
    const clientId = randomUUID();
    clients.set(clientId, {
      id: clientId,
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

        if (message.type === "create_order") {
          const walletAddress = String(message?.payload?.walletAddress || client.walletAddress || "").trim();
          const side = message?.payload?.side === "bid" ? "bid" : "ask";
          const baseToken = String(message?.payload?.baseToken || "MINIMA").toUpperCase();
          const quoteToken = String(message?.payload?.quoteToken || "USDT").toUpperCase();
          const price = Number(message?.payload?.price);
          const quantity = Number(message?.payload?.quantity);

          if (!walletAddress || !Number.isFinite(price) || price <= 0 || !Number.isFinite(quantity) || quantity <= 0) {
            sendMessage(socket, "error", { message: "Invalid order request." });
            return;
          }

          const orderId = randomUUID();
          orders.set(orderId, {
            id: orderId,
            walletAddress,
            side,
            baseToken,
            quoteToken,
            price: Number(price.toFixed(4)),
            quantity: String(quantity),
            remaining: String(quantity),
            status: "open",
            createdAt: Date.now(),
            updatedAt: Date.now()
          });

          sendMessage(socket, "order_created", { orderId });
          broadcastSnapshot(clients, orders, trades);
          return;
        }

        if (message.type === "cancel_order") {
          const orderId = String(message?.payload?.orderId || "");
          const walletAddress = String(message?.payload?.walletAddress || client.walletAddress || "").trim();
          const order = orders.get(orderId);

          if (!order || order.walletAddress !== walletAddress) {
            sendMessage(socket, "error", { message: "Order could not be cancelled." });
            return;
          }

          order.status = "cancelled";
          order.updatedAt = Date.now();
          orders.set(orderId, order);
          sendMessage(socket, "order_cancelled", { orderId });
          broadcastSnapshot(clients, orders, trades);
          return;
        }

        if (message.type === "take_order") {
          const orderId = String(message?.payload?.orderId || "");
          const quantity = Number(message?.payload?.quantity);
          const takerWallet = String(message?.payload?.walletAddress || client.walletAddress || "").trim();
          const order = orders.get(orderId);

          if (!order || !["open", "partial"].includes(order.status)) {
            sendMessage(socket, "error", { message: "Order is no longer available." });
            return;
          }

          if (!takerWallet || takerWallet === order.walletAddress) {
            sendMessage(socket, "error", { message: "You cannot take your own order." });
            return;
          }

          if (!Number.isFinite(quantity) || quantity <= 0 || quantity > Number(order.remaining)) {
            sendMessage(socket, "error", { message: "Invalid fill quantity." });
            return;
          }

          order.remaining = String(Number((Number(order.remaining) - quantity).toFixed(4)));
          order.status = Number(order.remaining) > 0 ? "partial" : "filled";
          order.updatedAt = Date.now();
          orders.set(orderId, order);

          const tradeId = randomUUID();
          const terms = deriveTradeTerms(order, quantity);
          const trade = {
            id: tradeId,
            orderId: order.id,
            baseToken: order.baseToken,
            quoteToken: order.quoteToken,
            makerWallet: order.walletAddress,
            orderSide: order.side,
            price: order.price,
            quantity: String(quantity),
            status: "awaiting_taker_settlement",
            takerWallet,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            ...terms
          };

          trades.set(tradeId, trade);
          sendMessage(socket, "trade_created", { trade });
          broadcastSnapshot(clients, orders, trades);
          return;
        }

        if (message.type === "trade_progress") {
          const tradeId = String(message?.payload?.tradeId || "");
          const walletAddress = String(message?.payload?.walletAddress || client.walletAddress || "").trim();
          const stage = String(message?.payload?.stage || "");
          const txpowid = String(message?.payload?.txpowid || "");
          const errorMessage = String(message?.payload?.errorMessage || "");
          const trade = trades.get(tradeId);

          if (!trade) {
            sendMessage(socket, "error", { message: "Trade could not be updated." });
            return;
          }

          if (![trade.makerWallet, trade.takerWallet].includes(walletAddress)) {
            sendMessage(socket, "error", { message: "Trade update rejected." });
            return;
          }

          trade.updatedAt = Date.now();

          if (stage === "taker_submitted") {
            trade.status = "taker_submitted";
            trade.takerTxPowId = txpowid;
          } else if (stage === "taker_confirmed") {
            trade.status = "awaiting_maker_settlement";
            trade.takerTxPowId = txpowid || trade.takerTxPowId || "";
          } else if (stage === "maker_submitted") {
            trade.status = "maker_submitted";
            trade.makerTxPowId = txpowid;
          } else if (stage === "completed") {
            trade.status = "completed";
            trade.makerTxPowId = txpowid || trade.makerTxPowId || "";
          } else if (stage === "failed") {
            trade.status = "failed";
            trade.errorMessage = errorMessage || "Settlement failed.";

            const order = orders.get(trade.orderId);
            if (order && !["cancelled", "completed"].includes(order.status)) {
              orders.set(order.id, restoreOrder(order, trade.quantity));
            }
          } else {
            sendMessage(socket, "error", { message: "Unknown trade stage." });
            return;
          }

          trades.set(tradeId, trade);
          broadcastSnapshot(clients, orders, trades);
        }
      } catch (error) {
        sendMessage(socket, "error", {
          message: error.message || "DEX relay message failed."
        });
      }
    });

    socket.on("close", () => {
      clients.delete(clientId);
    });
  });

  return wss;
}
