# ArcReplay

Transaction intelligence for Arc. ArcReplay turns an Arc Testnet transaction hash into a readable execution timeline, decodes Arc-native memo events, surfaces conservative review signals, and runs a read-only preflight against current chain state.

**Live:** [arcreplay.vercel.app](https://arcreplay.vercel.app)

## What works in v0.1

- Reads transactions, receipts, logs and finalized blocks from the public Arc Testnet RPC
- Decodes ERC-20 `Transfer` events and recognizes Arc USDC
- Decodes the Arc `Memo` wrapper call and `Memo` events
- Builds an ordered execution timeline and a copyable report
- Replays editable `from`, `to` and `calldata` with a read-only `eth_call`
- Exports a reproducible Viem test starter
- Includes a real live memo transaction as the demo

ArcReplay never requests a wallet signature and never submits a transaction.

## Local development

```bash
npm install
npm run dev
```

Production check:

```bash
npm run build
npm run preview
```

## Deploy to Vercel

Import the repository in Vercel. The included `vercel.json` uses `npm run build` and publishes `dist`.

## Arc references

- [Transaction memos](https://docs.arc.io/arc/concepts/transaction-memos)
- [Arc Testnet RPC](https://docs.arc.io/arc/references/rpc-endpoints)
- [Arc Testnet explorer](https://testnet.arcscan.app)

## Limitations

ArcReplay performs receipt/log decoding and read-only call simulation. Custom contract calls require an ABI for deeper decoding, and a fresh preflight reflects current state rather than historical block state. It is not a smart-contract security audit.

## License

MIT
