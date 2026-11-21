import { createPublicClient, createWalletClient, custom, getAddress, http, isAddress, parseUnits } from 'viem';
import { EthereumProvider } from '@walletconnect/ethereum-provider';
import { CHAINS, chainById, PERMIT2_ADDRESS } from './chains.js';
import { ERC20_ABI, ROUTER_ABI } from './core/abis.js';

const $ = (id) => document.getElementById(id);
const state = { provider: null, wallet: null, account: null, chain: null, wc: null, busy: false };

function status(message, kind = '') {
  const el = $('status');
  el.textContent = message;
  el.className = `status ${kind}`.trim();
}
function setBusy(busy, label) {
  state.busy = busy;
  $('settleButton').disabled = busy || !state.account;
  if (label) $('settleButton').textContent = label;
  else $('settleButton').textContent = state.account ? 'Approve & settle' : 'Connect wallet to continue';
}
function explorerTx(hash) {
  const root = state.chain?.blockExplorers?.default?.url;
  $('txLink').href = root ? `${root}/tx/${hash}` : '#';
  $('txLink').textContent = hash;
  $('txPanel').hidden = false;
}
function providerClient() {
  if (!state.provider || !state.chain) throw new Error('Connect a wallet and select a supported network.');
  return createPublicClient({ chain: state.chain, transport: http() });
}
function validateAddress(value, label) {
  if (!isAddress(value)) throw new Error(`${label} must be a valid EVM address.`);
  return getAddress(value);
}
function currentForm() {
  const router = validateAddress($('routerInput').value.trim(), 'Router address');
  const token = validateAddress($('tokenInput').value.trim(), 'Token address');
  const recipient = validateAddress($('recipientInput').value.trim(), 'Recipient address');
  const decimals = Number($('decimalsInput').value);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) throw new Error('Token decimals must be an integer from 0 to 255.');
  const amountText = $('amountInput').value.trim();
  if (!amountText || !/^\d+(\.\d+)?$/.test(amountText)) throw new Error('Enter a valid token amount.');
  const amount = parseUnits(amountText, decimals);
  if (amount <= 0n) throw new Error('Amount must be greater than zero.');
  return { router, token, recipient, amount };
}
async function switchToSelectedChain() {
  const selected = CHAINS.find((c) => String(c.id) === $('chainSelect').value);
  if (!selected) throw new Error('Select a supported chain.');
  if (!state.provider) throw new Error('Connect a wallet first.');
  const currentId = Number(await state.provider.request({ method: 'eth_chainId' }));
  if (currentId !== selected.id) {
    try {
      await state.provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: `0x${selected.id.toString(16)}` }] });
    } catch (error) {
      if (error?.code === 4902) {
        await state.provider.request({ method: 'wallet_addEthereumChain', params: [{
          chainId: `0x${selected.id.toString(16)}`, chainName: selected.name,
          nativeCurrency: selected.nativeCurrency, rpcUrls: [selected.rpcUrls.default.http[0]],
          blockExplorerUrls: [selected.blockExplorers.default.url]
        }] });
      } else throw error;
    }
  }
  state.chain = selected;
  state.wallet = createWalletClient({ account: state.account, chain: selected, transport: custom(state.provider) });
  $('networkLabel').textContent = selected.name;
  return selected;
}
function renderConnected() {
  $('walletLabel').textContent = state.account ? `${state.account.slice(0, 6)}…${state.account.slice(-4)}` : 'Wallet disconnected';
  $('connectButton').textContent = state.account ? 'Connected' : 'Connect wallet';
  $('settleButton').disabled = !state.account || state.busy;
  if (!state.busy) $('settleButton').textContent = state.account ? 'Approve & settle' : 'Connect wallet to continue';
}
async function attachProvider(provider) {
  state.provider = provider;
  const accounts = await provider.request({ method: 'eth_accounts' });
  if (!accounts?.length) await provider.request({ method: 'eth_requestAccounts' });
  const updated = await provider.request({ method: 'eth_accounts' });
  state.account = updated?.[0] ? getAddress(updated[0]) : null;
  const id = Number(await provider.request({ method: 'eth_chainId' }));
  const chain = chainById(id);
  if (chain) { $('chainSelect').value = String(chain.id); state.chain = chain; }
  state.wallet = chain && state.account ? createWalletClient({ account: state.account, chain, transport: custom(provider) }) : null;
  provider.on?.('accountsChanged', (accountsNext) => {
    state.account = accountsNext?.[0] ? getAddress(accountsNext[0]) : null;
    state.wallet = state.account && state.chain ? createWalletClient({ account: state.account, chain: state.chain, transport: custom(provider) }) : null;
    renderConnected();
  });
  provider.on?.('chainChanged', (hexId) => {
    const next = chainById(Number(hexId));
    if (next) { state.chain = next; $('chainSelect').value = String(next.id); }
    state.wallet = state.account && next ? createWalletClient({ account: state.account, chain: next, transport: custom(provider) }) : null;
    $('networkLabel').textContent = next?.name ?? 'Unsupported network';
  });
  renderConnected();
}
async function connect() {
  try {
    if (window.ethereum) {
      await attachProvider(window.ethereum);
      status('Wallet connected.', 'good');
      return;
    }
    const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
    if (!projectId) throw new Error('No injected wallet found. Set VITE_WALLETCONNECT_PROJECT_ID to enable WalletConnect v2.');
    const chains = CHAINS.map((chain) => chain.id);
    state.wc = await EthereumProvider.init({ projectId, chains, showQrModal: true, methods: ['eth_sendTransaction', 'personal_sign', 'eth_signTypedData_v4'], events: ['chainChanged', 'accountsChanged'] });
    await state.wc.connect();
    await attachProvider(state.wc);
    status('WalletConnect session connected.', 'good');
  } catch (error) { status(error?.shortMessage || error?.message || 'Wallet connection failed.', 'error'); }
}
async function settle() {
  if (state.busy) return;
  setBusy(true, 'Preparing settlement…');
  $('txPanel').hidden = true;
  try {
    if (!state.account) throw new Error('Connect a wallet first.');
    const chain = await switchToSelectedChain();
    const { router, token, recipient, amount } = currentForm();
    const client = providerClient();
    const wallet = createWalletClient({ account: state.account, chain, transport: custom(state.provider) });
    state.wallet = wallet;

    // Permit2 SignatureTransfer requires the ERC-20 token to approve Permit2 first.
    const allowance = await client.readContract({ address: token, abi: ERC20_ABI, functionName: 'allowance', args: [state.account, PERMIT2_ADDRESS] });
    if (allowance < amount) {
      setBusy(true, 'Approve token for Permit2…');
      const approvalHash = await wallet.writeContract({ address: token, abi: ERC20_ABI, functionName: 'approve', args: [PERMIT2_ADDRESS, amount] });
      status('Waiting for token approval confirmation…');
      await client.waitForTransactionReceipt({ hash: approvalHash });
    }

    const latest = await client.getBlock({ blockTag: 'latest' });
    const nonce = BigInt(crypto.getRandomValues(new Uint32Array(1))[0]) << 128n | BigInt(crypto.getRandomValues(new Uint32Array(1))[0]) << 96n | BigInt(Date.now());
    const deadline = BigInt(latest.timestamp) + 1200n;
    const permit = { permitted: { token, amount }, nonce, deadline };
    setBusy(true, 'Sign Permit2 transfer…');
    const signature = await wallet.signTypedData({
      account: state.account,
      domain: { name: 'Permit2', chainId: chain.id, verifyingContract: PERMIT2_ADDRESS },
      types: {
        TokenPermissions: [{ name: 'token', type: 'address' }, { name: 'amount', type: 'uint256' }],
        PermitTransferFrom: [{ name: 'permitted', type: 'TokenPermissions' }, { name: 'nonce', type: 'uint256' }, { name: 'deadline', type: 'uint256' }, { name: 'spender', type: 'address' }]
      },
      primaryType: 'PermitTransferFrom',
      message: { ...permit, spender: router }
    });

    setBusy(true, 'Submit settlement…');
    const hash = await wallet.writeContract({
      address: router, abi: ROUTER_ABI, functionName: 'settle',
      args: [token, state.account, recipient, amount, nonce, deadline, signature]
    });
    explorerTx(hash);
    status('Settlement submitted. Waiting for confirmation…');
    const receipt = await client.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error('Settlement transaction reverted.');
    status('Settlement confirmed on-chain.', 'good');
  } catch (error) {
    status(error?.shortMessage || error?.message || 'Settlement did not complete.', 'error');
  } finally { setBusy(false); }
}

for (const chain of CHAINS) {
  const option = document.createElement('option');
  option.value = String(chain.id);
  option.textContent = `${chain.name} · ${chain.id}`;
  $('chainSelect').append(option);
}
$('chainSelect').value = String(CHAINS[0].id);
state.chain = CHAINS[0];
$('chainSelect').addEventListener('change', () => {
  const chain = CHAINS.find((item) => String(item.id) === $('chainSelect').value);
  if (chain) { state.chain = chain; $('networkLabel').textContent = chain.name; }
});
$('connectButton').addEventListener('click', connect);
$('settleButton').addEventListener('click', settle);
renderConnected();
