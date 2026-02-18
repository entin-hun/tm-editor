type StoredWalletData = {
  code?: string;
  walletAddress?: string;
};

const STORAGE_PREFIX = 'emailwallet:';
const LOGGED_IN_KEY = 'loggedInUser';
const DEFAULT_RELAYER = 'https://relayerapi.emailwallet.org';

function getRelayerUrl(): string {
  return process.env.RELAYER_API_URL || DEFAULT_RELAYER;
}

function getStorageKey(email: string) {
  return `${STORAGE_PREFIX}${email}`;
}

export function getLoggedInEmail(): string {
  return window.localStorage.getItem(LOGGED_IN_KEY) || '';
}

export function setLoggedInEmail(email: string) {
  window.localStorage.setItem(LOGGED_IN_KEY, email);
  window.dispatchEvent(
    new CustomEvent('local-storage', { detail: { key: LOGGED_IN_KEY } })
  );
}

export function loadWalletData(email: string): StoredWalletData {
  if (!email) return {};
  try {
    const raw = window.localStorage.getItem(getStorageKey(email));
    return raw ? (JSON.parse(raw) as StoredWalletData) : {};
  } catch {
    return {};
  }
}

export function saveWalletData(email: string, data: StoredWalletData) {
  if (!email) return;
  window.localStorage.setItem(getStorageKey(email), JSON.stringify(data));
  window.dispatchEvent(
    new CustomEvent('local-storage', { detail: { key: getStorageKey(email) } })
  );
}

export function generateAccountCode() {
  return (
    '0x000' +
    Array.from({ length: 61 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('')
  );
}

export function ensureAccountCode(email: string) {
  if (!email) return '';
  const data = loadWalletData(email);
  if (data.code) return data.code;
  const code = generateAccountCode();
  saveWalletData(email, { ...data, code });
  return code;
}

export async function createAccount(email: string) {
  const response = await fetch(`${getRelayerUrl()}/api/createAccount`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email_addr: email }),
  });
  return response.text();
}

export async function isAccountCreated(email: string) {
  const response = await fetch(`${getRelayerUrl()}/api/isAccountCreated`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email_addr: email }),
  });
  return response.text();
}

export async function getWalletAddress(email: string, accountCode: string) {
  const code = accountCode.startsWith('0x') ? accountCode : `0x${accountCode}`;
  const response = await fetch(`${getRelayerUrl()}/api/getWalletAddress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email_addr: email, account_code: code }),
  });
  return response.text();
}

export async function transferNft(
  email: string,
  nftId: string,
  nftAddress: string,
  recipient: string
) {
  const isRecipientEmail = recipient.includes('@');
  const response = await fetch(`${getRelayerUrl()}/api/nftTransfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email_addr: email,
      nft_id: Number(nftId),
      nft_addr: nftAddress,
      recipient_addr: recipient,
      is_recipient_email: isRecipientEmail,
    }),
  });
  return response.text();
}
