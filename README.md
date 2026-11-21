# mx3 · Permit2 client runtime

A runnable client runtime and matching minimal Solidity settlement adapter. The browser flow connects an injected EVM wallet or WalletConnect v2, switches among configured chains, checks token allowance, approves Permit2 when needed, signs a Permit2 `PermitTransferFrom`, submits the signature to the router, and waits for the receipt.

## Run the client

```sh
npm install
cp .env.example .env.local
# Set VITE_WALLETCONNECT_PROJECT_ID to a project ID from WalletConnect Cloud (optional for injected wallets)
npm run dev
```

Open the Vite URL (normally `http://localhost:5173`). WalletConnect project ID is needed only when using WalletConnect instead of an injected provider.

## Deploy and configure

Compile and deploy `contracts/Permit2SettlementRouter.sol` with Solidity 0.8.24 or newer. Pass the canonical Permit2 deployment address for that chain to the constructor. The client currently uses `0x000000000022D473030F116dDEE9F6B43aC78BA3`.

In the UI provide the deployed router, an ERC-20 token address, recipient, token amount, and decimals. The source wallet must hold the tokens and have approved Permit2. The runtime submits that ERC-20 approval if the allowance is insufficient, then performs Permit2 signature transfer through the router. The router address signed as `spender` must be the deployed router address entered in the UI.

Supported client chain presets: Ethereum, Base, Arbitrum One, and Sepolia. Update `src/chains.js` to add or change RPC and explorer presets. Deploy the router separately on each selected network.

## Scope

This is a functioning **single-chain ERC-20 settlement** system, not a cross-chain bridge. Cross-chain delivery requires selecting and implementing a specific bridge/messaging adapter and destination settlement contract; no bridge is implied by Permit2. No token list or router address is hard-coded. The implementation uses standard Permit2 SignatureTransfer and a deliberately small router ABI that matches the included Solidity contract.

## Files

- `src/main.js`: wallet connection, chain switch, approval, permit signing, settlement transaction and receipt handling.
- `src/chains.js`: chain presets and canonical Permit2 address.
- `src/core/abis.js`: ERC-20 and included router ABIs.
- `contracts/Permit2SettlementRouter.sol`: deployable adapter that transfers permitted tokens to a recipient.
