export function getProgressPercent(processedFiles?: number, totalFiles?: number | null): number | null {
  if (!totalFiles || totalFiles <= 0 || processedFiles === undefined) {
    return null;
  }

  return Math.min(100, Math.round((processedFiles / totalFiles) * 100));
}
