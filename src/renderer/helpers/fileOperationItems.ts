import type { KnownFileOperationItem } from '../../shared/types/fileOperations';
import type { VideoRow } from '../../shared/types/video';

export function toKnownFileOperationItem(row: VideoRow): KnownFileOperationItem {
  return {
    id: row.id ?? row.path,
    sourcePath: row.path,
    fileName: row.fileName,
    expectedSizeBytes: row.fileSystemSizeBytes ?? row.sizeBytes ?? row.sourceSizeBytes ?? null,
    expectedModifiedAtMs: row.modifiedAtMs ?? null,
    identity: {
      path: row.path,
      fileName: row.fileName,
      extension: row.extension || row.fileExtension || '',
      sizeBytes: row.fileSystemSizeBytes ?? row.sizeBytes ?? row.sourceSizeBytes ?? null,
      modifiedAtMs: row.modifiedAtMs ?? null,
      createdAtMs: row.createdAtMs ?? null,
      isDirectory: false,
      isFile: true
    }
  };
}
