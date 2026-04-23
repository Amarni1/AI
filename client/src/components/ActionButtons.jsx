export default function ActionButtons({ onBalance, onAddress }) {
  return (
    <div className="flex flex-wrap gap-3">
      <button
        onClick={onBalance}
        className="btn-gold"
      >
        Refresh Wallet
      </button>
      <button
        onClick={onAddress}
        className="btn-secondary"
      >
        Fetch Address
      </button>
    </div>
  );
}
