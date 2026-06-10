import Constants from 'expo-constants';

// ──────────────────────────────────────────────────────────────────────────
// To point at a specific server, set OVERRIDE below (or the
// EXPO_PUBLIC_SERVER_URL env var for builds). Leave OVERRIDE empty for local
// dev and it auto-uses your computer's IP from Metro — works on real devices.
//   Production example: 'https://blackbox-server-d557.onrender.com'
// ──────────────────────────────────────────────────────────────────────────
const OVERRIDE = '';

const PORT = 5000;

// The machine running Metro = your dev computer. `localhost` would mean the
// phone itself, so we use Metro's host IP instead.
function devServerFromMetro(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)
      ?.debuggerHost;
  if (!hostUri) return null;
  const host = hostUri.split(':')[0];
  return host ? `http://${host}:${PORT}` : null;
}

export const SERVER_URL =
  OVERRIDE ||
  process.env.EXPO_PUBLIC_SERVER_URL ||
  devServerFromMetro() ||
  `http://localhost:${PORT}`;
