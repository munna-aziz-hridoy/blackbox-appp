import { SERVER_URL } from './config';

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    const message = data?.message;
    return Array.isArray(message) ? message.join(', ') : message ?? fallback;
  } catch {
    return fallback;
  }
}

export async function register(
  email: string,
  publicKey: string,
): Promise<{ devCode?: string }> {
  const res = await fetch(`${SERVER_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, publicKey }),
  });
  if (!res.ok) {
    throw new Error(await errorMessage(res, "Couldn't send the code. Try again."));
  }
  return res.json();
}

export async function verify(email: string, code: string): Promise<string> {
  const res = await fetch(`${SERVER_URL}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
  if (!res.ok) {
    throw new Error(await errorMessage(res, 'Invalid or expired code.'));
  }
  const data = await res.json();
  return data.identityKey;
}

export type SearchResult = {
  userId: string;
  publicKey: string;
  online: boolean;
};

export async function registerPushToken(
  token: string,
  identityKey: string,
): Promise<void> {
  await fetch(`${SERVER_URL}/push-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${identityKey}`,
    },
    body: JSON.stringify({ token }),
  }).catch(() => {});
}

export type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

export async function getTurnCredentials(
  identityKey: string,
): Promise<{ iceServers: IceServer[]; ttl: number }> {
  const res = await fetch(`${SERVER_URL}/turn-credentials`, {
    headers: { Authorization: `Bearer ${identityKey}` },
  });
  if (!res.ok) throw new Error('Could not get call servers.');
  return res.json();
}

export async function searchUser(
  email: string,
  identityKey: string,
): Promise<SearchResult | null> {
  const res = await fetch(
    `${SERVER_URL}/search?email=${encodeURIComponent(email)}`,
    { headers: { Authorization: `Bearer ${identityKey}` } },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('search failed');
  return res.json();
}
