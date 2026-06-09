import * as SecureStore from 'expo-secure-store';

const IDENTITY_KEY = 'identityKey';
const PUBLIC_KEY = 'publicKey';
const SECRET_KEY = 'secretKey';

export type Identity = {
  identityKey: string;
  publicKey: string;
  secretKey: string;
};

export async function loadIdentity(): Promise<Identity | null> {
  const [identityKey, publicKey, secretKey] = await Promise.all([
    SecureStore.getItemAsync(IDENTITY_KEY),
    SecureStore.getItemAsync(PUBLIC_KEY),
    SecureStore.getItemAsync(SECRET_KEY),
  ]);
  if (!identityKey || !publicKey || !secretKey) return null;
  return { identityKey, publicKey, secretKey };
}

export async function saveIdentity(identity: Identity): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(IDENTITY_KEY, identity.identityKey),
    SecureStore.setItemAsync(PUBLIC_KEY, identity.publicKey),
    SecureStore.setItemAsync(SECRET_KEY, identity.secretKey),
  ]);
}

export async function clearIdentity(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(IDENTITY_KEY),
    SecureStore.deleteItemAsync(PUBLIC_KEY),
    SecureStore.deleteItemAsync(SECRET_KEY),
  ]);
}

// Legacy tokens embedded the email; new tokens don't. Used only to backfill the
// local profile for users who signed in before the privacy change.
export function emailFromKey(identityKey: string): string | null {
  try {
    const base64 = identityKey
      .split('.')[0]
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    return JSON.parse(atob(base64)).email ?? null;
  } catch {
    return null;
  }
}
