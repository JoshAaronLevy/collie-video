import type { SelectedFolderSummary } from '../../shared/types/folderTree';
import type { PersistedFolderTreeSource } from '../../shared/types/settings';
import { dedupeOverlappingFolderPaths } from '../../shared/utils/folderPathSelection';

export function getPersistedFolderTreeSourcePaths(source: PersistedFolderTreeSource): string[] {
  return dedupeOverlappingFolderPaths(
    source.dedupedSelectedFolderPaths.length > 0
      ? source.dedupedSelectedFolderPaths
      : source.selectedFolderPaths
  );
}

export function createPersistedFolderTreeSource({
  rootPath,
  selectedFolderPaths,
  dedupedSelectedFolderPaths,
  summary,
  includeSubfolders,
  lastScannedAt
}: {
  rootPath: string;
  selectedFolderPaths: string[];
  dedupedSelectedFolderPaths: string[];
  summary: SelectedFolderSummary;
  includeSubfolders: boolean;
  lastScannedAt: string | null;
}): PersistedFolderTreeSource {
  const dedupedFolderPaths = dedupeOverlappingFolderPaths(dedupedSelectedFolderPaths);

  return {
    rootPath,
    selectedFolderPaths,
    dedupedSelectedFolderPaths: dedupedFolderPaths,
    selectedFolderSummary: {
      ...summary,
      dedupedFolderPaths,
      dedupedFolderCount: dedupedFolderPaths.length
    },
    includeSubfolders,
    lastScannedAt
  };
}
