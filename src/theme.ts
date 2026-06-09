export const colors = {
  brandDark: '#075E54',
  brand: '#128C7E',
  accent: '#25D366',
  chatBg: '#ECE5DD',
  bubbleOut: '#DCF8C6',
  bubbleIn: '#FFFFFF',
  bg: '#FFFFFF',
  surface: '#F4F6F8',
  text: '#111827',
  muted: '#6B7280',
  faint: '#9CA3AF',
  border: '#E5E7EB',
  danger: '#DC2626',
  tick: '#8696A0',
  tickRead: '#34B7F1',
  white: '#FFFFFF',
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

// Stable per-string color so avatars aren't all the same green.
const avatarPalette = [
  '#0a7d62',
  '#1f6feb',
  '#b4540a',
  '#7c3aed',
  '#be185d',
  '#0e7490',
  '#4d7c0f',
];

export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return avatarPalette[Math.abs(hash) % avatarPalette.length];
}
