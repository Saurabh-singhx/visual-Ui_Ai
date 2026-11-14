import fs from 'fs';
import path from 'path';
import { expect } from 'vitest';
import type { ComponentMetadata, ScanResponse, ElementDetail } from './apiHarness';

/**
 * Asserts that a component with the specified name or matching file path exists in scan results
 */
export function assertComponentDiscovered(
  components: ComponentMetadata[],
  nameOrPath: string,
  platform?: 'web' | 'mobile' | 'desktop'
): ComponentMetadata {
  expect(components, 'Components array should be defined and non-empty').toBeDefined();
  expect(Array.isArray(components), 'Components should be an array').toBe(true);

  const matched = components.find((c) => {
    const nameMatches = c.name === nameOrPath;
    const pathMatches = c.filePath.includes(nameOrPath) || c.relativePath.includes(nameOrPath);
    return nameMatches || pathMatches;
  });

  expect(
    matched,
    `Expected component matching "${nameOrPath}" to be discovered, but found: ${JSON.stringify(
      components.map((c) => ({ name: c.name, rel: c.relativePath, platform: c.platform }))
    )}`
  ).toBeDefined();

  if (platform && matched) {
    expect(
      matched.platform,
      `Expected component "${nameOrPath}" to have platform "${platform}", but was "${matched.platform}"`
    ).toBe(platform);
  }

  return matched!;
}

/**
 * Asserts that no component in the scan results matches the excluded pattern or file path
 */
export function assertComponentExcluded(components: ComponentMetadata[], patternOrPath: string): void {
  expect(components, 'Components array should be defined').toBeDefined();

  const normalizedPattern = patternOrPath.replace(/\\/g, '/');

  const found = components.find((c) => {
    const rel = (c?.relativePath || '').replace(/\\/g, '/');
    const name = c?.name || '';
    return rel.includes(normalizedPattern) || name === normalizedPattern || name.includes(normalizedPattern);
  });

  expect(
    found,
    `Expected "${patternOrPath}" to be strictly excluded from scan, but discovered: ${JSON.stringify(found)}`
  ).toBeUndefined();
}

/**
 * Asserts that the scan result triggers the high-volume (>30) threshold and includes suggested focus areas
 */
export function assertHighVolumeDetected(response: ScanResponse, expectedThreshold: number = 30): void {
  expect(response, 'Scan response should be defined').toBeDefined();
  expect(
    response.totalCount,
    `Total count (${response.totalCount}) should exceed threshold (${expectedThreshold})`
  ).toBeGreaterThan(expectedThreshold);

  expect(
    response.exceedsThreshold,
    `exceedsThreshold flag should be true when count (${response.totalCount}) > ${expectedThreshold}`
  ).toBe(true);

  expect(response.folderBreakdown, 'Folder breakdown should be provided for high-volume workspaces').toBeDefined();
  expect(Object.keys(response.folderBreakdown).length, 'Folder breakdown should have folders').toBeGreaterThan(0);

  expect(response.suggestedFocus, 'suggestedFocus must be provided for high-volume workspaces').toBeDefined();
  expect(Array.isArray(response.suggestedFocus), 'suggestedFocus should be an array').toBe(true);
  expect(response.suggestedFocus!.length, 'suggestedFocus should contain suggestions').toBeGreaterThan(0);
}

/**
 * Asserts that a given folder exists in the breakdown with at least minCount components
 */
export function assertFolderBreakdown(
  breakdown: Record<string, number>,
  folderKey: string,
  minCount: number = 1
): void {
  expect(breakdown, 'breakdown object must be defined').toBeDefined();
  const count = breakdown[folderKey];
  expect(
    count,
    `Folder "${folderKey}" should be in breakdown with count >= ${minCount}, but got ${count}`
  ).toBeDefined();
  expect(count).toBeGreaterThanOrEqual(minCount);
}

/**
 * Validates AST element hierarchy properties
 */
export function assertElementHierarchyValid(elements: ElementDetail[]): void {
  expect(elements, 'Elements array must be defined').toBeDefined();
  expect(Array.isArray(elements), 'Elements should be an array').toBe(true);
  expect(elements.length, 'Elements should not be empty').toBeGreaterThan(0);

  for (const el of elements) {
    expect(el.id, `Element ${JSON.stringify(el)} must have an id`).toBeDefined();
    expect(typeof el.id).toBe('string');
    expect(el.tag, `Element ${el.id} must have a tag`).toBeDefined();
    expect(typeof el.tag).toBe('string');
    expect(el.type, `Element ${el.id} must have a valid type classification`).toBeDefined();
    expect(
      ['button', 'header', 'input', 'container', 'card', 'text', 'other'],
      `Element ${el.id} type "${el.type}" must be an allowed ElementDetail type`
    ).toContain(el.type);
    expect(typeof el.classes, `Element ${el.id} classes must be a string`).toBe('string');
    expect(typeof el.codeSnippet, `Element ${el.id} codeSnippet must be a string`).toBe('string');
    expect(el.codeSnippet.length, `Element ${el.id} codeSnippet must be non-empty`).toBeGreaterThan(0);
    expect(typeof el.startLine).toBe('number');
    expect(typeof el.endLine).toBe('number');
    expect(el.endLine).toBeGreaterThanOrEqual(el.startLine);
  }
}

/**
 * Asserts that an element matches expected classification type
 */
export function assertElementClassification(
  element: ElementDetail,
  expectedType: ElementDetail['type']
): void {
  expect(element, 'Element must be defined').toBeDefined();
  expect(
    element.type,
    `Element <${element.tag}> expected type "${expectedType}", received "${element.type}"`
  ).toBe(expectedType);
}

/**
 * Asserts that a backup file was created on disk for the target file
 */
export function assertBackupCreated(
  backupPath: string,
  originalPath: string,
  expectedContent?: string
): void {
  expect(backupPath, 'backupPath must be a non-empty string').toBeDefined();
  expect(typeof backupPath).toBe('string');
  expect(backupPath.length).toBeGreaterThan(0);

  const exists = fs.existsSync(backupPath);
  expect(exists, `Backup file must exist on disk at path: ${backupPath}`).toBe(true);

  // Backup should contain '.bak'
  expect(
    backupPath.includes('.bak'),
    `Backup path "${backupPath}" should contain '.bak'`
  ).toBe(true);

  // Validate that backupPath relates to originalPath
  const originalBase = path.basename(originalPath);
  const backupBase = path.basename(backupPath);
  expect(
    backupBase.startsWith(originalBase) || backupPath.includes(originalBase),
    `Backup path "${backupPath}" must relate to original path basename "${originalBase}"`
  ).toBe(true);

  // Backup content should be non-empty
  const content = fs.readFileSync(backupPath, 'utf8');
  expect(content.length, 'Backup file should have non-empty content').toBeGreaterThan(0);

  if (expectedContent !== undefined) {
    expect(content, 'Backup file content should match expected pre-modification content').toBe(expectedContent);
  }
}

/**
 * Asserts that a target file was restored to its expected original content after rollback
 */
export function assertRollbackRestored(filePath: string, expectedOriginalContent: string): void {
  expect(fs.existsSync(filePath), `Target file ${filePath} must exist`).toBe(true);
  const actualContent = fs.readFileSync(filePath, 'utf8');
  expect(
    actualContent,
    `Target file ${filePath} content after rollback should match expected original content byte-for-byte`
  ).toBe(expectedOriginalContent);
}

const DEFAULT_ANIMATION_PATTERNS: (RegExp | string)[] = [
  /\btransition(-[a-z]+)?\b/,
  /\bduration-\d+\b/,
  /\bease-(linear|in|out|in-out)\b/,
  /\bhover:scale-\d+\b/,
  /\banimate-\w+\b/,
];

/**
 * Asserts that code contains Tailwind animation or transition classes
 */
export function assertTailwindAnimationApplied(
  code: string,
  patternsOrKeywords?: (RegExp | string)[]
): void {
  expect(code, 'Code string must be defined').toBeDefined();

  const patterns = patternsOrKeywords ?? DEFAULT_ANIMATION_PATTERNS;

  const hasAnimation = patterns.some((p) => {
    if (typeof p === 'string') {
      if (p === 'ease') {
        return /\bease-(linear|in|out|in-out)\b/.test(code);
      }
      return code.includes(p);
    }
    return p.test(code);
  });

  expect(
    hasAnimation,
    `Code should contain at least one animation utility keyword or regex pattern matching animation classes. Code snippet:\n${code.slice(0, 300)}`
  ).toBe(true);
}
