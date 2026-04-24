# MINIMA AI Direct On-Chain Swap DEX

This app now runs as a frontend-only MiniMask swap experience.

## Architecture

1. `client/` contains the premium React dashboard
2. MiniMask handles wallet connection, balance reads, signing, and transaction sending
3. The app builds swap metadata locally and writes it into Minima transaction state variables
4. The UI polls `checktxpow` directly through MiniMask until the transaction confirms

There is no payout API or required swap backend in the live flow.

## Direct On-Chain Flow

1. Connect MiniMask
2. Read wallet balances and sendable amounts
3. Build a swap quote locally in the browser
4. Create a real Minima transaction with swap metadata in the state variables
5. Sign and send through MiniMask
6. Show `Submitted -> Processing -> Success` once the txpow confirms

## Run

Install dependencies at the workspace root, then run the frontend:

```bash
npm run dev:client
```

Default local URL:

- Frontend: `http://localhost:5173`

The production build still runs from the workspace root with:

```bash
npm run build
```

## Environment

Create a local `.env` from `.env.example` if you want to customize:

- `VITE_SWAP_SIGNAL_AMOUNT`
- `VITE_SWAP_TOKEN_ID_USDT`

This build is configured for just two tokens: `MINIMA` and `USDT`.

## Important Limitation

This mode creates real Minima blockchain transactions, but it does not automatically settle the quoted destination token. For a quote like `MINIMA -> USDT` to represent a real token movement, that destination token must already exist on Minima and be referenced by a real token id.
