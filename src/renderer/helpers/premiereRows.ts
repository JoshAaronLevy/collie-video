import type { PremiereRequestVideo } from '../../shared/types/premiere';
import type { VideoRow } from '../../shared/types/video';

export function toPremiereRequestVideo(row: VideoRow): PremiereRequestVideo {
  return {
    id: row.id ?? row.path,
    fileName: row.fileName,
    absolutePath: row.path,
    directory: row.directory,
    durationSeconds: row.durationSeconds,
    width: row.width,
    height: row.height,
    displayAspectRatio: row.displayAspectRatio || null,
    frameRate: row.frameRate
  };
}
