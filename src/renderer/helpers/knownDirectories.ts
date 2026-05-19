import type { VideoRow } from '../../shared/types/video';

export function getKnownDirectories({
  auditedRootDirectory,
  selectedFolders,
  selectedVideos
}: {
  auditedRootDirectory: string | null;
  selectedFolders: string[];
  selectedVideos: VideoRow[];
}): string[] {
  return [
    ...new Set([
      auditedRootDirectory,
      ...selectedFolders,
      ...selectedVideos.map((video) => video.directory)
    ].filter((value): value is string => Boolean(value)))
  ];
}
