import { describe, it, expect } from 'vitest';
import {
  normalizeHex,
  hexToRgb,
  calculateContrast,
  auditTouchTarget,
} from './wcagUtils';

describe('wcagUtils', () => {
  it('normalizes 3-digit and 6-digit hex codes correctly', () => {
    expect(normalizeHex('#fff')).toBe('#FFFFFF');
    expect(normalizeHex('000')).toBe('#000000');
    expect(normalizeHex('#6366f1')).toBe('#6366F1');
    expect(normalizeHex('invalid')).toBe('#000000');
  });

  it('converts hex to RGB channels accurately', () => {
    expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb('rgb(100, 150, 200)')).toEqual({ r: 100, g: 150, b: 200 });
    expect(hexToRgb('rgba(255, 0, 0, 0.5)')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb('rgba(0, 0, 0, 0)')).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb('white')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('calculates maximum contrast ratio (21:1) for black on white', () => {
    const result = calculateContrast('#000000', '#ffffff');
    expect(result.ratio).toBe(21);
    expect(result.score).toBe('AAA');
    expect(result.aaNormal).toBe(true);
    expect(result.aaaNormal).toBe(true);
  });

  it('correctly flags low-contrast text failing WCAG AA (e.g. light gray on white)', () => {
    const result = calculateContrast('#a0aec0', '#ffffff');
    expect(result.ratio).toBeLessThan(4.5);
    expect(result.score).toBe('FAIL');
    expect(result.aaNormal).toBe(false);
  });

  it('audits touch target dimensions against minimum 44x44px recommendation', () => {
    const pass = auditTouchTarget(48, 48);
    expect(pass.compliant).toBe(true);

    const fail = auditTouchTarget(30, 20);
    expect(fail.compliant).toBe(false);
    expect(fail.details).toContain('too small');
  });
});
