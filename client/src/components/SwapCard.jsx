import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { formatUsdPrice } from "../services/marketData";
import {
  formatDisplayedAmount,
  getOwnedTokenBalances
} from "../services/walletPortfolio";
import { formatWalletAddress } from "../services/walletData";
import ConfirmModal from "./ConfirmModal";
import LoadingDots from "./LoadingDots";

function ModeButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active ? "btn-gold !px-4 !py-2" : "btn-secondary !px-4 !py-2"}
    >
      {children}
    </button>
  );
}

function BlockBadge({ blockLoading, blockNumber }) {
  if (blockLoading) {
    return <LoadingDots label="Reading block" />;
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-emerald-200">
      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.9)]" />
      {blockNumber !== null ? `Minima Network • Block #${blockNumber}` : "Minima Network • Awaiting block"}
    </div>
  );
}

export default function SwapCard({
  availableTokens,
  blockLoading,
  blockNumber,
  connected,
  form,
  marketPrices,
  mode,
  onExecuteExchange,
  onExecuteSwap,
  onFlip,
  onModeChange,
  onSetField,
  onSetSendField,
  previewQuote,
  quote,
  quoteLoading,
  sendDisabledReason,
  sendForm,
  sendLoading,
  sendSourceBalance,
  sourceBalance,
  swapDisabledReason,
  swapLoading,
  tokenBalances = [],
  walletAddress,
  walletLoading,
  zeroBalanceWarning
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const activeQuote = quote || previewQuote;
  const ownedTokens = getOwnedTokenBalances(tokenBalances).slice(0, 3);
  const isSwapMode = mode === "swap";

  const confirmDetails = useMemo(() => {
    if (!activeQuote) {
      return [];
    }

    return [
      { label: "From", value: `${activeQuote.amount} ${activeQuote.fromToken}` },
      { label: "To", value: `${activeQuote.receiveAmount} ${activeQuote.toToken}` },
      {
        label: "Rate",
        value:
          activeQuote.priceFrom && activeQuote.priceTo
            ? `${formatUsdPrice(activeQuote.priceFrom)} -> ${formatUsdPrice(activeQuote.priceTo)}`
            : "Live rate unavailable"
      }
    ];
  }, [activeQuote]);

  async function handleConfirmSwap() {
    setConfirmOpen(false);
    await onExecuteSwap();
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
              <p className="section-kicker">Settlement Widget</p>
              <h2 className="mt-2 font-display text-3xl font-semibold text-slate-900 dark:text-white">
                Exchange and swap execution
              </h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-700 dark:text-slate-200">
                Secure settlement tools powered by MiniMask, live prices, and direct Minima confirmation tracking.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <ModeButton active={!isSwapMode} onClick={() => onModeChange("exchange")}>
                Exchange
              </ModeButton>
              <ModeButton active={isSwapMode} onClick={() => onModeChange("swap")}>
                Swap
              </ModeButton>
            </div>
          </div>

          <div className="rounded-[28px] border border-[#e5c76f] bg-[linear-gradient(180deg,#050505_0%,#111111_100%)] p-4 shadow-[0_36px_70px_rgba(15,23,42,0.32)]">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-white/10 bg-white/5 px-4 py-3">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.32em] text-white/45">
                  Settlement route
                </p>
                <p className="mt-2 text-sm font-bold text-white">
                  {connected ? formatWalletAddress(walletAddress) : "MiniMask not connected"}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <BlockBadge blockLoading={blockLoading} blockNumber={blockNumber} />
                {walletLoading ? (
                  <LoadingDots label="Syncing wallet" />
                ) : (
                  <span className="rounded-full bg-ma-gold/15 px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.24em] text-ma-gold">
                    Direct settlement
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-white/45">
                  MINIMA
                </p>
                <p className="mt-2 text-lg font-black text-white">{formatUsdPrice(marketPrices.MINIMA)}</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-white/45">
                  USDT
                </p>
                <p className="mt-2 text-lg font-black text-white">{formatUsdPrice(marketPrices.USDT)}</p>
              </div>
            </div>

            {ownedTokens.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {ownedTokens.map((token) => (
                  <span
                    key={token.id || token.symbol}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-extrabold uppercase tracking-[0.18em] text-white"
                  >
                    {token.symbol}: {formatDisplayedAmount(token.sendable)}
                  </span>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-[22px] border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-100">
                {zeroBalanceWarning}
              </div>
            )}

            {isSwapMode ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-[24px] border border-white/10 bg-black/45 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-white/55">
                      From
                    </p>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-ma-gold">
                      Sendable {formatDisplayedAmount(sourceBalance)} {form.fromToken}
                    </p>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
                    <input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={form.amount}
                      onChange={(event) => onSetField("amount", event.target.value)}
                      className="w-full bg-transparent text-4xl font-black text-white outline-none placeholder:text-white/20"
                      placeholder="0.0"
                    />
                    <select
                      value={form.fromToken}
                      onChange={(event) => onSetField("fromToken", event.target.value)}
                      className="input-premium !rounded-[18px] !border-white/10 !bg-[#151515] !text-white"
                    >
                      {availableTokens.map((token) => (
                        <option key={token} value={token}>
                          {token}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={onFlip}
                    className="btn-gold !h-12 !w-12 !justify-center !rounded-full !px-0 !py-0"
                  >
                    {"><"}
                  </button>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-black/45 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-white/55">
                      To
                    </p>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-ma-gold">
                      Live quote
                    </p>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
                    <div className="text-4xl font-black text-white">
                      {activeQuote ? activeQuote.receiveAmount : "0.0000"}
                    </div>
                    <select
                      value={form.toToken}
                      onChange={(event) => onSetField("toToken", event.target.value)}
                      className="input-premium !rounded-[18px] !border-white/10 !bg-[#151515] !text-white"
                    >
                      {availableTokens.map((token) => (
                        <option key={token} value={token}>
                          {token}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/80">
                  {activeQuote
                    ? `${activeQuote.amount} ${activeQuote.fromToken} = ${activeQuote.receiveAmount} ${activeQuote.toToken}`
                    : "Choose two different tokens and enter an amount to build a quote."}
                </div>

                {swapDisabledReason ? (
                  <div className="rounded-[20px] border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-100">
                    {swapDisabledReason}
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => setConfirmOpen(true)}
                  disabled={swapLoading || quoteLoading || Boolean(swapDisabledReason)}
                  className="btn-gold w-full justify-center disabled:pointer-events-none disabled:opacity-60"
                >
                  {swapLoading
                    ? "Submitting..."
                    : quoteLoading
                      ? "Pricing..."
                      : connected
                        ? "Confirm Swap"
                        : "Connect Wallet"}
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="rounded-[24px] border border-white/10 bg-black/45 p-4">
                  <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-white/55">
                    Settlement recipient
                  </p>
                  <input
                    value={sendForm.address}
                    onChange={(event) => onSetSendField("address", event.target.value)}
                    placeholder="Mx... or 0x..."
                    className="input-premium mt-4 !rounded-[18px] !border-white/10 !bg-[#151515] !text-white"
                  />
                </div>

                <div className="rounded-[24px] border border-white/10 bg-black/45 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-white/55">
                      Amount
                    </p>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-ma-gold">
                      Sendable {formatDisplayedAmount(sendSourceBalance)} {sendForm.token}
                    </p>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
                    <input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={sendForm.amount}
                      onChange={(event) => onSetSendField("amount", event.target.value)}
                      className="w-full bg-transparent text-4xl font-black text-white outline-none placeholder:text-white/20"
                      placeholder="0.0"
                    />
                    <select
                      value={sendForm.token}
                      onChange={(event) => onSetSendField("token", event.target.value)}
                      className="input-premium !rounded-[18px] !border-white/10 !bg-[#151515] !text-white"
                    >
                      {availableTokens.map((token) => (
                        <option key={token} value={token}>
                          {token}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {sendDisabledReason ? (
                  <div className="rounded-[20px] border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-100">
                    {sendDisabledReason}
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={onExecuteExchange}
                  disabled={sendLoading || Boolean(sendDisabledReason)}
                  className="btn-gold w-full justify-center disabled:pointer-events-none disabled:opacity-60"
                >
                  {sendLoading
                    ? "Submitting..."
                    : connected
                      ? "Exchange in MiniMask"
                      : "Connect Wallet"}
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.section>

      <ConfirmModal
        confirmLabel="Confirm"
        description="Review this swap request before MiniMask opens."
        details={confirmDetails}
        message={activeQuote ? `${activeQuote.amount} ${activeQuote.fromToken} -> ${activeQuote.receiveAmount} ${activeQuote.toToken}` : ""}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirmSwap}
        open={confirmOpen}
        title="Confirm Swap"
      />
    </>
  );
}
