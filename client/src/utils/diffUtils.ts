export interface DiffLine {
  type: 'addition' | 'deletion' | 'context';
  text: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffResult {
  lines: DiffLine[];
  additionsCount: number;
  deletionsCount: number;
}

/**
 * Computes line-by-line diff between original and new code using LCS (Longest Common Subsequence)
 */
export function computeLineDiff(oldCode: string = '', newCode: string = ''): DiffResult {
  const cleanOld = (oldCode || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const cleanNew = (newCode || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const oldLines = cleanOld ? cleanOld.split('\n') : [];
  const newLines = cleanNew ? cleanNew.split('\n') : [];

  const m = oldLines.length;
  const n = newLines.length;

  // Build DP table for Longest Common Subsequence
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to reconstruct the diff
  let i = m;
  let j = n;
  const rawDiff: Array<{ type: 'context' | 'addition' | 'deletion'; text: string; oldLine?: number; newLine?: number }> = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      rawDiff.push({
        type: 'context',
        text: oldLines[i - 1],
        oldLine: i,
        newLine: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rawDiff.push({
        type: 'addition',
        text: newLines[j - 1],
        newLine: j,
      });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      rawDiff.push({
        type: 'deletion',
        text: oldLines[i - 1],
        oldLine: i,
      });
      i--;
    }
  }

  rawDiff.reverse();

  let additionsCount = 0;
  let deletionsCount = 0;
  const lines: DiffLine[] = rawDiff.map((item) => {
    if (item.type === 'addition') additionsCount++;
    if (item.type === 'deletion') deletionsCount++;

    return {
      type: item.type,
      text: item.text,
      oldLineNumber: item.oldLine,
      newLineNumber: item.newLine,
    };
  });

  return {
    lines,
    additionsCount,
    deletionsCount,
  };
}
