export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen) + '...';
}
