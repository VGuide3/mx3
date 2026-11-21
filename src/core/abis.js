export const ERC20_ABI = [
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] }
];
export const ROUTER_ABI = [
  { type: 'function', name: 'settle', stateMutability: 'nonpayable', inputs: [{ name: 'token', type: 'address' }, { name: 'owner', type: 'address' }, { name: 'recipient', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'nonce', type: 'uint256' }, { name: 'deadline', type: 'uint256' }, { name: 'signature', type: 'bytes' }], outputs: [] },
  { type: 'event', name: 'Settled', inputs: [{ name: 'owner', type: 'address', indexed: true }, { name: 'token', type: 'address', indexed: true }, { name: 'recipient', type: 'address', indexed: true }, { name: 'amount', type: 'uint256', indexed: false }] }
];
