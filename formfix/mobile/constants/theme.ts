export const Colors = {
  bg:        '#0a0a0a',
  surface:   '#141414',
  card:      '#1c1c1c',
  border:    '#2a2a2a',
  accent:    '#00E676',       // green — form correct
  warn:      '#FFD600',       // yellow — caution
  danger:    '#FF1744',       // red — bad form
  snapYellow:'#FFFC00',
  text:      '#FFFFFF',
  textMuted: '#888888',
  textDim:   '#444444',
};

export const Font = {
  sizes: { xs: 11, sm: 13, md: 15, lg: 18, xl: 24, xxl: 36, hero: 56 },
  weight: { regular: '400', medium: '500', semi: '600', bold: '700', black: '900' } as const,
};

export const Radius = { sm: 8, md: 14, lg: 20, xl: 28, full: 999 };
export const Space  = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };