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

function OrderRow({ actionLabel, onAction, order, ownOrder }) {
  const remaining = Number(order.remaining || 0);
  const total = Number((remaining * Number(order.price || 0)).toFixed(4));

  return (
    <div className="grid grid-cols-[92px_86px_1fr_auto] items-center gap-3 rounded-[18px] border border-white/10 bg-white/5 px-3 py-3 text-sm font-semibold text-white">
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

function DepthTable({ levels, tone }) {
  return (
    <div className="space-y-2">
      {levels.length ? (
        levels.slice(0, 6).map((level) => (
          <div
            key={`${tone}-${level.price}`}
            className="grid grid-cols-[92px_1fr_64px] items-center gap-3 rounded-[16px] border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white/75"
          >
            <span className={tone === "bid" ? "text-emerald-300" : "text-rose-300"}>{formatPrice(level.price)}</span>
            <span>{formatDisplayedAmount(level.quantity)}</span>
            <span className="text-right">{level.orders}</span>
          </div>
        ))
      ) : (
        <div className="rounded-[16px] border border-white/10 bg-white/5 px-4 py-4 text-sm font-semibold text-white/55">
          No depth yet.
        </div>
      )}
    </div>
  );
}

export default function DexExchangePanel({
  askLevels,
  asks,
  availableBalance,
  availableTokens,
  bestAsk,
  bestBid,
  bidLevels,
  bids,
  cancelLoadingId,
  cancelOrder,
  connected,
  connectionState,
  confirmIncomingTrade,
  confirmPendingTrade,
  createDisabledReason,
  createLoading,
  createOrder,
  currentMarket,
  dismissIncomingTrade,
  dismissPendingTrade,
  error,
  formatTradeStatus,
  incomingTrade,
  incomingTradeDetails,
  myOrders,
  myTrades,
  orderForm,
  pendingTrade,
  quoteTokenOptions,
  referencePrice,
  requestTakeOrder,
  requiredAmount,
  setOrderField,
  spendToken,
  spread,
  status,
  totalAskDepth,
  totalBidDepth,
  tradeDetails,
  tradeLoadingId,
  walletAddress
}) {
  const [takeDraft, setTakeDraft] = useState(null);
  const [takeQuantity, setTakeQuantity] = useState("");

  const takeDetails = useMemo(() => {
    if (!takeDraft) {
      return [];
    }

    const quantity = Number(takeQuantity || takeDraft.remaining || 0);
    const notional = Number((quantity * Number(takeDraft.price || 0)).toFixed(4));

    return [
      { label: "Market", value: `${takeDraft.baseToken}/${takeDraft.quoteToken}` },
      { label: "Price", value: formatPrice(takeDraft.price) },
      { label: "Quantity", value: `${formatDisplayedAmount(quantity)} ${takeDraft.baseToken}` },
      { label: "Notional", value: `${formatDisplayedAmount(notional)} ${takeDraft.quoteToken}` }
    ];
  }, [takeDraft, takeQuantity]);

  async function handleTakeOrder() {
    if (!takeDraft) {
      return;
    }

    try {
      await requestTakeOrder(takeDraft, takeQuantity || takeDraft.remaining);
      setTakeDraft(null);
      setTakeQuantity("");
    } catch {
      // Hook already surfaces the live error state.
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
                Real orderbook for {currentMarket.baseToken} / {currentMarket.quoteToken}
              </h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-700 dark:text-slate-200">
                Orders rest on the live book, matching happens against real bids and asks, and each trade is signed in MiniMask as an atomic transaction.
              </p>
            </div>

            <div className="rounded-full bg-emerald-400/10 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.24em] text-emerald-300">
              {connectionState === "connected" ? "Relay live" : "Reconnecting"}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-5">
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
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-white/45">CoinGecko Ref</p>
              <p className="mt-2 text-lg font-black text-white">
                {referencePrice !== null ? formatPrice(referencePrice) : "Unavailable"}
              </p>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[370px_minmax(0,1fr)]">
            <div className="space-y-4 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#050505_0%,#111111_100%)] p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-white/50">Maker Order</p>
                {createLoading ? <LoadingDots label="Posting" /> : null}
              </div>

              <div className="grid gap-3">
                <select
                  value={orderForm.baseToken}
                  onChange={(event) => setOrderField("baseToken", event.target.value)}
                  className="input-premium !rounded-[18px] !border-white/10 !bg-[#151515] !text-white"
                >
                  {availableTokens.map((token) => (
                    <option key={`base-${token.tokenId || token.symbol}`} value={token.symbol}>
                      Base: {token.symbol}
                    </option>
                  ))}
                </select>

                <select
                  value={orderForm.quoteToken}
                  onChange={(event) => setOrderField("quoteToken", event.target.value)}
                  className="input-premium !rounded-[18px] !border-white/10 !bg-[#151515] !text-white"
                >
                  {quoteTokenOptions.map((token) => (
                    <option key={`quote-${token.tokenId || token.symbol}`} value={token.symbol}>
                      Quote: {token.symbol}
                    </option>
                  ))}
                </select>

                <select
                  value={orderForm.side}
                  onChange={(event) => setOrderField("side", event.target.value)}
                  className="input-premium !rounded-[18px] !border-white/10 !bg-[#151515] !text-white"
                >
                  <option value="ask">ASK - Sell {currentMarket.baseToken}</option>
                  <option value="bid">BID - Buy {currentMarket.baseToken}</option>
                </select>

                <input
                  value={orderForm.price}
                  onChange={(event) => setOrderField("price", event.target.value)}
                  placeholder={`Price in ${currentMarket.quoteToken}`}
                  type="number"
                  min="0"
                  step="0.0001"
                  className="input-premium !rounded-[18px] !border-white/10 !bg-[#151515] !text-white"
                />
                <input
                  value={orderForm.quantity}
                  onChange={(event) => setOrderField("quantity", event.target.value)}
                  placeholder={`Quantity in ${currentMarket.baseToken}`}
                  type="number"
                  min="0"
                  step="0.0001"
                  className="input-premium !rounded-[18px] !border-white/10 !bg-[#151515] !text-white"
                />
              </div>

              <div className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/80">
                {connected ? (
                  <>
                    Spendable {spendToken}: {formatDisplayedAmount(availableBalance)}
                    <br />
                    Required for order: {formatDisplayedAmount(requiredAmount)} {spendToken}
                  </>
                ) : (
                  "Connect MiniMask to publish or take real DEX orders."
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
                {createLoading ? "Placing..." : "Place Live Order"}
              </button>
            </div>

            <div className="grid gap-5">
              <div className="grid gap-5 xl:grid-cols-2">
                <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#050505_0%,#111111_100%)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-emerald-300">Bids</p>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">Buyers of {currentMarket.baseToken}</p>
                  </div>
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
                        No bids on this market yet.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#050505_0%,#111111_100%)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-rose-300">Asks</p>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">Sellers of {currentMarket.baseToken}</p>
                  </div>
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
                        No asks on this market yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-5 xl:grid-cols-2">
                <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#050505_0%,#111111_100%)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-white/50">Bid Depth</p>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">Price / Qty / Orders</p>
                  </div>
                  <div className="mt-4">
                    <DepthTable levels={bidLevels} tone="bid" />
                  </div>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#050505_0%,#111111_100%)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-white/50">Ask Depth</p>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">Price / Qty / Orders</p>
                  </div>
                  <div className="mt-4">
                    <DepthTable levels={askLevels} tone="ask" />
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
                            <p>
                              {order.side === "bid" ? "BID" : "ASK"} {order.baseToken}/{order.quoteToken}
                            </p>
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
                  <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-white/50">My Trades</p>
                  <div className="mt-4 space-y-3">
                    {myTrades.length ? (
                      myTrades.map((trade) => (
                        <div
                          key={trade.id}
                          className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-4 text-sm font-semibold text-white"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p>
                              {trade.quantity} {trade.baseToken} at {formatPrice(trade.price)}
                            </p>
                            <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-ma-gold">
                              {formatTradeStatus(trade.status)}
                            </span>
                          </div>
                          <p className="mt-2 text-white/70">
                            Maker {formatWalletAddress(trade.makerWallet)} / Taker {formatWalletAddress(trade.takerWallet)}
                          </p>
                          {trade.txpowid ? (
                            <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-300">
                              TxPoW {trade.txpowid}
                            </p>
                          ) : null}
                        </div>
                      ))
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
        confirmLabel="Reserve Fill"
        description="Lock this orderbook fill before the atomic trade is created."
        details={takeDetails}
        message="The relay will reserve this quantity on the book, then MiniMask will prepare an atomic trade for signature."
        onCancel={() => {
          setTakeDraft(null);
          setTakeQuantity("");
        }}
        onConfirm={handleTakeOrder}
        open={Boolean(takeDraft)}
        title="Confirm Match"
      />

      <ConfirmModal
        confirmLabel={tradeLoadingId === pendingTrade?.id ? "Signing..." : "Sign In MiniMask"}
        description="Review the live atomic trade before MiniMask signs your taker leg."
        details={tradeDetails}
        message="MiniMask will sign the prepared raw transaction and forward it to the maker for the final chain post."
        onCancel={dismissPendingTrade}
        onConfirm={confirmPendingTrade}
        open={Boolean(pendingTrade)}
        title="Confirm Atomic Trade"
      />

      <ConfirmModal
        confirmLabel={tradeLoadingId === incomingTrade?.id ? "Posting..." : "Validate And Post"}
        description="Review the incoming atomic trade from the orderbook before MiniMask posts it on-chain."
        details={incomingTradeDetails}
        message="The maker leg validates the raw transaction locally, then MiniMask signs and posts it to Minima."
        onCancel={dismissIncomingTrade}
        onConfirm={confirmIncomingTrade}
        open={Boolean(incomingTrade)}
        title="Counterparty Signature Request"
      />
    </>
  );
}
