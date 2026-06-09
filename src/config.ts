import Constants from 'expo-constants';

const PORT = 5000;

// Derive the server host from the machine Metro is served from, so the app
// always reaches the right dev machine even when its LAN IP changes.
function hostFromExpo(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)
      ?.debuggerHost;
  if (!hostUri) return null;
  const host = hostUri.split(':')[0];
  return host ? `http://${host}:${PORT}` : null;
}

// Override order: explicit env var → Expo host → last-known fallback.
export const SERVER_URL =
  process.env.EXPO_PUBLIC_SERVER_URL ??
  hostFromExpo() ??
  'http://192.168.1.106:5000';
