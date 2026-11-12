/**
 * WCAG 2.1 / 2.2 Color Contrast and Accessibility Utilities
 */

export interface ContrastResult {
  ratio: number;
  ratioFormatted: string;
  aaNormal: boolean;     // 4.5:1
  aaLarge: boolean;      // 3:1
  aaaNormal: boolean;    // 7:1
  aaaLarge: boolean;     // 4.5:1
  score: 'AAA' | 'AA' | 'FAIL';
}

/**
 * Normalizes any hex string into standard 6-character hex #RRGGBB
 */
export function normalizeHex(hex: string): string {
  if (!hex || typeof hex !== 'string') return '#000000';
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  if (clean.length === 4) {
    clean = clean.substring(0, 3).split('').map((c) => c + c).join('');
  }
  if (clean.length === 8) {
    clean = clean.substring(0, 6);
  }
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
    return '#000000';
  }
  return `#${clean.toUpperCase()}`;
}

/**
 * Converts Hex or CSS RGB/RGBA / named color to RGB channels
 */
export function hexToRgb(colorStr: string): { r: number; g: number; b: number } {
  if (!colorStr || typeof colorStr !== 'string') {
    return { r: 0, g: 0, b: 0 };
  }

  const trimmed = colorStr.trim().toLowerCase();

  // Handle common named colors
  if (trimmed === 'white') return { r: 255, g: 255, b: 255 };
  if (trimmed === 'black') return { r: 0, g: 0, b: 0 };
  if (trimmed === 'transparent') return { r: 255, g: 255, b: 255 };

  // Handle rgb(r, g, b) or rgba(r, g, b, a)
  const rgbMatch = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([0-9.]+))?/);
  if (rgbMatch) {
    // If alpha is 0 (fully transparent), treat as transparent white
    if (rgbMatch[4] !== undefined && parseFloat(rgbMatch[4]) === 0) {
      return { r: 255, g: 255, b: 255 };
    }
    return {
      r: Math.min(255, Math.max(0, parseInt(rgbMatch[1], 10))),
      g: Math.min(255, Math.max(0, parseInt(rgbMatch[2], 10))),
      b: Math.min(255, Math.max(0, parseInt(rgbMatch[3], 10))),
    };
  }

  const norm = normalizeHex(colorStr);
  const r = parseInt(norm.substring(1, 3), 16);
  const g = parseInt(norm.substring(3, 5), 16);
  const b = parseInt(norm.substring(5, 7), 16);
  return { r, g, b };
}

/**
 * Calculates relative luminance according to W3C formula
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function getRelativeLuminance(rgb: { r: number; g: number; b: number }): number {
  const transform = (val: number) => {
    const s = val / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = transform(rgb.r);
  const g = transform(rgb.g);
  const b = transform(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculates contrast ratio between foreground and background colors
 */
export function calculateContrast(fgHex: string, bgHex: string): ContrastResult {
  const fgRgb = hexToRgb(fgHex);
  const bgRgb = hexToRgb(bgHex);

  const l1 = getRelativeLuminance(fgRgb);
  const l2 = getRelativeLuminance(bgRgb);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  const ratio = (lighter + 0.05) / (darker + 0.05);
  const rounded = Math.round(ratio * 100) / 100;

  const aaNormal = rounded >= 4.5;
  const aaLarge = rounded >= 3.0;
  const aaaNormal = rounded >= 7.0;
  const aaaLarge = rounded >= 4.5;

  let score: 'AAA' | 'AA' | 'FAIL' = 'FAIL';
  if (aaaNormal) score = 'AAA';
  else if (aaNormal) score = 'AA';

  return {
    ratio: rounded,
    ratioFormatted: `${rounded.toFixed(1)}:1`,
    aaNormal,
    aaLarge,
    aaaNormal,
    aaaLarge,
    score,
  };
}

/**
 * Checks if touch target dimensions meet WCAG 2.5.5 / 2.5.8 recommendations (min 44x44 or 48x48)
 */
export function auditTouchTarget(width: number, height: number): {
  compliant: boolean;
  minRecommended: number;
  details: string;
} {
  const minRecommended = 44;
  const compliant = width >= minRecommended && height >= minRecommended;
  return {
    compliant,
    minRecommended,
    details: compliant
      ? `Meets minimum recommended size (${width}x${height}px >= 44x44px)`
      : `Touch target too small (${width}x${height}px < 44x44px). Can cause miss-clicks on mobile.`,
  };
}
