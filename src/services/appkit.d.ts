export function initAppKit(): Promise<any>;
export function openAppKitModal(): Promise<void>;
export function openAppKitOnramp(): Promise<void>;
export function disconnectAppKit(): Promise<void>;
export function getAppKitAddress(): string | undefined;
export function onAppKitAccount(
  cb: (info: { address: string; walletName: string } | null) => void
): () => void;
