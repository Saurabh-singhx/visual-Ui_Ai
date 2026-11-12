import { describe, it, expect } from 'vitest';
import { computeLineDiff } from './diffUtils';

describe('diffUtils', () => {
  it('detects no changes for identical strings', () => {
    const code = 'const x = 10;\nconsole.log(x);';
    const diff = computeLineDiff(code, code);
    expect(diff.additionsCount).toBe(0);
    expect(diff.deletionsCount).toBe(0);
    expect(diff.lines.every((l) => l.type === 'context')).toBe(true);
  });

  it('accurately tracks single line additions and deletions', () => {
    const oldCode = 'const a = 1;\nconst b = 2;';
    const newCode = 'const a = 1;\nconst b = 2;\nconst c = 3;';
    const diff = computeLineDiff(oldCode, newCode);
    expect(diff.additionsCount).toBe(1);
    expect(diff.deletionsCount).toBe(0);
    expect(diff.lines.some((l) => l.type === 'addition' && l.text === 'const c = 3;')).toBe(true);
  });

  it('handles empty strings smoothly without exceptions', () => {
    const diff = computeLineDiff('', 'new line');
    expect(diff.additionsCount).toBe(1);
    expect(diff.deletionsCount).toBe(0);
  });

  it('accurately preserves context when lines are added at the start or middle without desynchronizing', () => {
    const oldCode = 'line 1\nline 2\nline 3';
    const newCode = 'line 0\nline 1\nline 2\nline 3';
    const diff = computeLineDiff(oldCode, newCode);
    expect(diff.additionsCount).toBe(1);
    expect(diff.deletionsCount).toBe(0);
    expect(diff.lines[0]).toEqual({
      type: 'addition',
      text: 'line 0',
      newLineNumber: 1,
      oldLineNumber: undefined,
    });
    expect(diff.lines.slice(1).every((l) => l.type === 'context')).toBe(true);
  });

  it('correctly tracks replacement in the middle of text', () => {
    const oldCode = 'header\nold-body\nfooter';
    const newCode = 'header\nnew-body\nfooter';
    const diff = computeLineDiff(oldCode, newCode);
    expect(diff.additionsCount).toBe(1);
    expect(diff.deletionsCount).toBe(1);
    expect(diff.lines.find((l) => l.text === 'header')?.type).toBe('context');
    expect(diff.lines.find((l) => l.text === 'footer')?.type).toBe('context');
  });

  it('normalizes CRLF and LF differences without false line additions and deletions', () => {
    const oldCode = 'line 1\r\nline 2\r\nline 3';
    const newCode = 'line 1\nline 2\nline 3';
    const diff = computeLineDiff(oldCode, newCode);
    expect(diff.additionsCount).toBe(0);
    expect(diff.deletionsCount).toBe(0);
    expect(diff.lines.every((l) => l.type === 'context')).toBe(true);
  });
});
