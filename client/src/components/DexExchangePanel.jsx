import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { formatDisplayedAmount } from "../services/walletPortfolio";
import { formatWalletAddress } from "../services/walletData";
import ConfirmModal from "./ConfirmModal";
import LoadingDots from "./LoadingDots";

function formatDepth(value) {
  return formatDisplayedAmount(value || 0);
}

function formatPrice(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `$${numeric.toFixed(4)}` : "$0.0000";
}

function formatTradeStatus(status) {
  switch (status) {
    case "awaiting_taker_settlement":
      return "Awaiting taker settlement";
    case "taker_submitted":
      return "Taker submitted";
    case "awaiting_maker_settlement":
      return "Awaiting maker settlement";
    case "maker_submitted":
      return "Maker submitted";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

function OrderRow({ actionLabel, onAction, order, ownOrder }) {
  const remaining = Number(order.remaining || 0);
  const total = Number((remaining * Number(order.price || 0)).toFixed(4));

  return (
    <div className="grid grid-cols-[88px_90px_1fr_auto] items-center gap-3 rounded-[18px] border border-white/10 bg-white/5 px-3 py-3 text-sm font-semibold text-white">
      <div>{formatPrice(order.price)}</div>
      <div>{formatDisplayedAmount(remaining)}</div>
      <div className="text-white/70">
        {formatDisplayedAmount(total)} {order.quoteToken}
      </div>
      {ownOrder ? (
        <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.2em] text-ma-gold">
          Yours
        </span>
      ) : (
        <button type="button" onClick={() => onAction(order)} className="btn-gold !px-3 !py-2 !text-[11px]">
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default function DexExchangePanel({
  availableBalance,
  asks,
  bestAsk,
  bestBid,
  cancelLoadingId,
  cancelOrder,
  connected,
  connectionState,
  createDisabledReason,
  createLoading,
  createOrder,
  error,
  myOrders,
  myTrades,
  orderForm,
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
  walletAddress,
  bids
}) {
  const [takeDraft, setTakeDraft] = useState(null);
  const [takeQuantity, setTakeQuantity] = useState("");
  const [settlementTrade, setSettlementTrade] = useState(null);

  const takeDetails = useMemo(() => {
    if (!takeDraft) {
      return [];
    }

    const quantity = Number(takeQuantity || takeDraft.remaining || 0);
    const notional = Number((quantity * Number(takeDraft.price || 0)).toFixed(4));

    return [
      { label: "Order", value: `${takeDraft.side.toUpperCase()} ${takeDraft.baseToken}/${takeDraft.quoteToken}` },
      { label: "Price", value: formatPrice(takeDraft.price) },
      { label: "Quantity", value: `${formatDisplayedAmount(quantity)} ${takeDraft.baseToken}` },
      { label: "Notional", value: `${formatDisplayedAmount(notional)} ${takeDraft.quoteToken}` }
    ];
  }, [takeDraft, takeQuantity]);

  const settlementDetails = useMemo(() => {
    if (!settlementTrade || !walletAddress) {
      return [];
    }

    const isMaker = settlementTrade.makerWallet === walletAddress;
    const token = isMaker ? settlementTrade.makerSendsToken : settlementTrade.takerSendsToken;
    const amount = isMaker ? settlementTrade.makerSendsAmount : settlementTrade.takerSendsAmount;
    const recipient = isMaker ? settlementTrade.takerWallet : settlementTrade.makerWallet;

    return [
      { label: "Trade", value: `${settlementTrade.baseToken}/${settlementTrade.quoteToken}` },
      { label: "Role", value: isMaker ? "Maker" : "Taker" },
      { label: "Send", value: `${amount} ${token}` },
      { label: "Recipient", value: recipient }
    ];
  }, [settlementTrade, walletAddress]);

  async function handleTakeOrder() {
    if (!takeDraft) {
      return;
    }

    try {
      const trade = await requestTakeOrder(takeDraft, takeQuantity || takeDraft.remaining);
      setTakeDraft(null);
      setTakeQuantity("");
      setSettlementTrade(trade);
    } catch {
      // The hook already surfaces the error state.
    }
  }

  async function handleSettleTrade() {
    if (!settlementTrade) {
      return;
    }

    try {
      await settleTrade(settlementTrade);
      setSettlementTrade(null);
    } catch {
      // The hook already surfaces the error state.
    }
  }

  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="panel-surface overflow-hidden p-5"
      >
        <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.22),transparent_72%)]" />
        <div className="relative space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="section-kicker">Live Exchange</p>
              <h2 className="mt-2 font-display text-3xl font-semibold text-slate-900 dark:text-white">
                P2P orderbook for MINIMA / USDT
              </h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-700 dark:text-slate-200">
                Place maker orders, view live bids and asks, match against active depth, and settle each side with MiniMask.
              </p>
            </div>

            <div className="rounded-full bg-emerald-400/10 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.24em] text-emerald-300">
              {connectionState === "connected" ? "Relay live" : "Reconnecting"}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-white/45">Best Bid</p>
              <p className="mt-2 text-lg font-black text-white">{bestBid ? formatPrice(bestBid.price) : "--"}</p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-white/45">Best Ask</p>
              <p className="mt-2 text-lg font-black text-white">{bestAsk ? formatPrice(bestAsk.price) : "--"}</p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-white/45">Spread</p>
              <p className="mt-2 text-lg font-black text-white">{spread !== null ? formatPrice(spread) : "--"}</p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-white/45">Depth</p>
              <p className="mt-2 text-lg font-black text-white">
                {formatDepth(totalBidDepth)} / {formatDepth(totalAskDepth)}
              </p>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="space-y-4 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#050505_0%,#111111_100%)] p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-white/50">Maker Order</p>
                {createLoading ? <LoadingDots label="Placing" /> : null}
              </div>

              <div className="grid gap-3">
                <select
                  value={orderForm.side}
                  onChange={(event) => setOrderField("side", event.target.value)}
                  className="input-premium !rounded-[18px] !border-white/10 !bg-[#151515] !text-white"
                >
                  <option value="ask">ASK - Sell MINIMA for USDT</option>
                  <option value="bid">BID - Buy MINIMA with USDT</option>
                </select>
                <input
                  value={orderForm.price}
                  onChange={(event) => setOrderField("price", event.target.value)}
                  placeholder="Price in USDT"
                  type="number"
                  min="0"
                  step="0.0001"
                  className="input-premium !rounded-[18px] !border-white/10 !bg-[#151515] !text-white"
                />
                <input
                  value={orderForm.quantity}
                  onChange={(event) => setOrderField("quantity", event.target.value)}
                  placeholder="Quantity in MINIMA"
                  type="number"
                  min="0"
                  step="0.0001"
                  className="input-premium !rounded-[18px] !border-white/10 !bg-[#151515] !text-white"
                />
              </div>

              <div className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/80">
                {connected ? (
                  <>
                    Available {sellToken}: {formatDisplayedAmount(availableBalance)}
                    <br />
                    Required for order: {formatDisplayedAmount(requiredAmount)} {sellToken}
                  </>
                ) : (
                  "Connect MiniMask to place or settle DEX orders."
                )}
              </div>

              {createDisabledReason ? (
                <div className="rounded-[20px] border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-100">
                  {createDisabledReason}
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => void createOrder()}
                disabled={Boolean(createDisabledReason) || createLoading}
                className="btn-gold w-full justify-center disabled:pointer-events-none disabled:opacity-60"
              >
                {createLoading ? "Placing..." : "Place Order"}
              </button>
            </div>

            <div className="grid gap-5">
              <div className="grid gap-5 xl:grid-cols-2">
                <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#050505_0%,#111111_100%)] p-4">
                  <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-emerald-300">Bids</p>
                  <div className="mt-4 space-y-3">
                    {bids.length ? (
                      bids.map((order) => (
                        <OrderRow
                          key={order.id}
                          actionLabel="Take"
                          onAction={(selectedOrder) => {
                            setTakeDraft(selectedOrder);
                            setTakeQuantity(selectedOrder.remaining);
                          }}
                          order={order}
                          ownOrder={walletAddress === order.walletAddress}
                        />
                      ))
                    ) : (
                      <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-4 text-sm font-semibold text-white/60">
                        No bids on the book yet.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#050505_0%,#111111_100%)] p-4">
                  <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-rose-300">Asks</p>
                  <div className="mt-4 space-y-3">
                    {asks.length ? (
                      asks.map((order) => (
                        <OrderRow
                          key={order.id}
                          actionLabel="Take"
                          onAction={(selectedOrder) => {
                            setTakeDraft(selectedOrder);
                            setTakeQuantity(selectedOrder.remaining);
                          }}
                          order={order}
                          ownOrder={walletAddress === order.walletAddress}
                        />
                      ))
                    ) : (
                      <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-4 text-sm font-semibold text-white/60">
                        No asks on the book yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-5 xl:grid-cols-2">
                <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#050505_0%,#111111_100%)] p-4">
                  <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-white/50">My Orders</p>
                  <div className="mt-4 space-y-3">
                    {myOrders.length ? (
                      myOrders.map((order) => (
                        <div
                          key={order.id}
                          className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-4 text-sm font-semibold text-white"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p>{order.side.toUpperCase()} {order.baseToken}/{order.quoteToken}</p>
                            <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-ma-gold">
                              {order.status}
                            </span>
                          </div>
                          <p className="mt-2 text-white/70">
                            {formatDisplayedAmount(order.remaining)} / {formatDisplayedAmount(order.quantity)} at {formatPrice(order.price)}
                          </p>
                          {["open", "partial"].includes(order.status) ? (
                            <button
                              type="button"
                              onClick={() => void cancelOrder(order.id)}
                              disabled={cancelLoadingId === order.id}
                              className="btn-secondary mt-3 !px-3 !py-2 !text-[11px]"
                            >
                              {cancelLoadingId === order.id ? "Cancelling..." : "Cancel"}
                            </button>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-4 text-sm font-semibold text-white/60">
                        No maker orders from this wallet yet.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#050505_0%,#111111_100%)] p-4">
                  <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-white/50">Matched Trades</p>
                  <div className="mt-4 space-y-3">
                    {myTrades.length ? (
                      myTrades.map((trade) => {
                        const isMaker = trade.makerWallet === walletAddress;
                        const canSettle =
                          (trade.status === "awaiting_taker_settlement" && !isMaker) ||
                          (trade.status === "awaiting_maker_settlement" && isMaker);

                        return (
                          <div
                            key={trade.id}
                            className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-4 text-sm font-semibold text-white"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p>{trade.quantity} {trade.baseToken} at {formatPrice(trade.price)}</p>
                              <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-ma-gold">
                                {formatTradeStatus(trade.status)}
                              </span>
                            </div>
                            <p className="mt-2 text-white/70">
                              Maker {formatWalletAddress(trade.makerWallet)} / Taker {formatWalletAddress(trade.takerWallet)}
                            </p>
                            {canSettle ? (
                              <button
                                type="button"
                                onClick={() => setSettlementTrade(trade)}
                                disabled={settlementLoadingId === trade.id}
                                className="btn-gold mt-3 !px-3 !py-2 !text-[11px]"
                              >
                                {settlementLoadingId === trade.id ? "Settling..." : isMaker ? "Settle Maker Leg" : "Settle Taker Leg"}
                              </button>
                            ) : null}
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-4 text-sm font-semibold text-white/60">
                        No matched trades for this wallet yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/80">
            {error || status}
          </div>
        </div>
      </motion.section>

      <ConfirmModal
        confirmLabel="Match Order"
        description="Review this live orderbook fill before the trade is allocated."
        details={takeDetails}
        message="After matching, MiniMask settlement will be required from the taker side first."
        onCancel={() => {
          setTakeDraft(null);
          setTakeQuantity("");
        }}
        onConfirm={handleTakeOrder}
        open={Boolean(takeDraft)}
        title="Confirm Fill"
      />

      <ConfirmModal
        confirmLabel="Settle in MiniMask"
        description="Review this DEX settlement leg before MiniMask opens."
        details={settlementDetails}
        message="This sends your side of the matched trade through MiniMask and updates the live trade status on confirmation."
        onCancel={() => setSettlementTrade(null)}
        onConfirm={handleSettleTrade}
        open={Boolean(settlementTrade)}
        title="Confirm Settlement"
      />
    </>
  );
}
