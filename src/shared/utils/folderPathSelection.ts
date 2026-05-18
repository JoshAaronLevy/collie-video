interface FolderPathRecord {
  originalPath: string;
  normalizedPath: string;
  depth: number;
}

export function dedupeOverlappingFolderPaths(folderPaths: string[]): string[] {
  const recordsByNormalizedPath = new Map<string, FolderPathRecord>();

  folderPaths.forEach((folderPath) => {
    const normalizedPath = normalizeFolderPathForComparison(folderPath);

    if (!normalizedPath || recordsByNormalizedPath.has(normalizedPath)) {
      return;
    }

    recordsByNormalizedPath.set(normalizedPath, {
      originalPath: folderPath,
      normalizedPath,
      depth: getFolderPathDepth(normalizedPath)
    });
  });

  return Array.from(recordsByNormalizedPath.values())
    .sort((first, second) => {
      if (first.depth !== second.depth) {
        return first.depth - second.depth;
      }

      return first.normalizedPath.localeCompare(second.normalizedPath);
    })
    .reduce<string[]>((keptPaths, record) => {
      const isContainedByKeptPath = keptPaths.some((keptPath) =>
        isPathAtOrInside(keptPath, record.originalPath)
      );

      if (!isContainedByKeptPath) {
        keptPaths.push(record.originalPath);
      }

      return keptPaths;
    }, []);
}

export function isPathAtOrInside(parentPath: string, childPath: string): boolean {
  const normalizedParentPath = normalizeFolderPathForComparison(parentPath);
  const normalizedChildPath = normalizeFolderPathForComparison(childPath);

  if (!normalizedParentPath || !normalizedChildPath) {
    return false;
  }

  if (normalizedParentPath === normalizedChildPath) {
    return true;
  }

  if (normalizedParentPath === '/') {
    return normalizedChildPath.startsWith('/');
  }

  return normalizedChildPath.startsWith(`${normalizedParentPath}/`);
}

export function normalizeFolderPathForComparison(folderPath: string): string {
  const normalizedPath = folderPath.trim().replace(/\\/g, '/').replace(/\/+/g, '/');

  if (normalizedPath === '/' || /^[A-Za-z]:\/$/.test(normalizedPath)) {
    return normalizedPath;
  }

  return normalizedPath.replace(/\/+$/g, '');
}

function getFolderPathDepth(folderPath: string): number {
  if (folderPath === '/') {
    return 0;
  }

  return normalizeFolderPathForComparison(folderPath)
    .split('/')
    .filter((part) => part.length > 0).length;
}
