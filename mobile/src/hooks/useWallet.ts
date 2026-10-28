import { useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { INVALID_ADDRESS_ERROR, isValidStellarAddress } from '../../utils/stellarValidation';

const WALLET_KEY = 'greenpay_stellar_public_key';

export function useWallet() {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // `finally` alone does not consume the rejection — without `.catch`,
    // any storage error (e.g. Keychain unavailable on a stale device)
    // would surface as an `UnhandledPromiseRejection`, which Jest treats
    // as a test failure even when we set `loading=false` correctly.
    SecureStore.getItemAsync(WALLET_KEY)
      .then((stored) => setPublicKey(stored))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const connect = useCallback(async (address: string) => {
    setError(null);
    const trimmed = address.trim();

    if (!isValidStellarAddress(trimmed)) {
      setError(INVALID_ADDRESS_ERROR);
      return false;
    }

    // Storage is best-effort in one direction only: if the Keychain entry
    // can't be written (stale device, OS-level migration), we stay
    // disconnected instead of flipping `publicKey`, so the UI keeps showing
    // "Connect wallet" and the caller sees `false`.
    try {
      await SecureStore.setItemAsync(WALLET_KEY, trimmed);
    } catch {
      setError('Could not save wallet to secure storage. Please try again.');
      return false;
    }

    setPublicKey(trimmed);
    return true;
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await SecureStore.deleteItemAsync(WALLET_KEY);
    } catch {
      // Storage failure is non-fatal; the in-memory key is cleared below so
      // the user is never left "connected" after choosing to disconnect.
    }
    setPublicKey(null);
  }, []);

  return { publicKey, loading, error, connect, disconnect };
}
