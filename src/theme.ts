export const colors = {
  // Monochrome, premium. Headers/buttons are near-black; surfaces warm off-white.
  brandDark: '#0B0B0C',
  brand: '#0B0B0C',
  accent: '#0B0B0C',
  chatBg: '#ECECEC',
  bubbleOut: '#0B0B0C',
  bubbleIn: '#FFFFFF',
  bg: '#FFFFFF',
  surface: '#F4F4F5',
  text: '#0B0B0C',
  muted: '#6B6B70',
  faint: '#A1A1A6',
  border: '#E8E8EA',
  danger: '#D92D20',
  tick: '#A1A1A6',
  tickRead: '#0B0B0C',
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

// Monochrome avatar shades so initials read as premium, not colorful.
const avatarPalette = ['#111113', '#26262B', '#3A3A40', '#1C1C20', '#2F2F35'];

export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return avatarPalette[Math.abs(hash) % avatarPalette.length];
}
