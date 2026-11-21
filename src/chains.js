import { defineChain } from 'viem';

export const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3';

export const CHAINS = [
  defineChain({ id: 1, name: 'Ethereum', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['https://cloudflare-eth.com'] } }, blockExplorers: { default: { name: 'Etherscan', url: 'https://etherscan.io' } } }),
  defineChain({ id: 8453, name: 'Base', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['https://mainnet.base.org'] } }, blockExplorers: { default: { name: 'Basescan', url: 'https://basescan.org' } } }),
  defineChain({ id: 42161, name: 'Arbitrum One', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['https://arb1.arbitrum.io/rpc'] } }, blockExplorers: { default: { name: 'Arbiscan', url: 'https://arbiscan.io' } } }),
  defineChain({ id: 11155111, name: 'Sepolia', nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['https://ethereum-sepolia-rpc.publicnode.com'] } }, blockExplorers: { default: { name: 'Etherscan Sepolia', url: 'https://sepolia.etherscan.io' } } })
];
export const chainById = (id) => CHAINS.find((chain) => chain.id === id);
