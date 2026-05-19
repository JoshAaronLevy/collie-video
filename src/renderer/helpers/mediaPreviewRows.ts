import type {
  MediaPreviewResultItem,
  PreviewClipResultItem
} from '../../shared/types/mediaPreview';
import type { VideoPreviewFrame, VideoRow } from '../../shared/types/video';

export function mergeMediaPreviewItems(rows: VideoRow[], items: MediaPreviewResultItem[]): VideoRow[] {
  if (items.length === 0) {
    return rows;
  }

  const itemsByPath = new Map<string, MediaPreviewResultItem>();

  for (const item of items) {
    const key = item.path ?? item.absolutePath;

    if (key) {
      itemsByPath.set(key, item);
    }
  }

  return rows.map((row) => {
    const item = itemsByPath.get(row.path);

    if (!item) {
      return row;
    }

    const nextRow: VideoRow = {
      ...row,
      thumbnail: item.thumbnail
    };

    if (item.previewFrames) {
      nextRow.previewFrames = item.previewFrames.frames;
      nextRow.previewFrameBatchId = item.previewFrames.batchId;
      nextRow.maxPreviewFrameCount = item.previewFrames.maxPreviewFrameCount;
    }

    return nextRow;
  });
}

export function mergePreviewClipItems(rows: VideoRow[], items: PreviewClipResultItem[]): VideoRow[] {
  if (items.length === 0) {
    return rows;
  }

  const itemsByPath = new Map<string, PreviewClipResultItem>();

  for (const item of items) {
    const key = item.path ?? item.absolutePath;

    if (key) {
      itemsByPath.set(key, item);
    }
  }

  return rows.map((row) => {
    const item = itemsByPath.get(row.path);

    if (!item) {
      return row;
    }

    return {
      ...row,
      previewFrames: mergePreviewFrames(row.previewFrames ?? [], item.previewFrames),
      previewFrameBatchId: row.previewFrameBatchId ?? item.previewFrames[0]?.batchId,
      maxPreviewFrameCount: row.maxPreviewFrameCount ?? item.previewFrames.length
    };
  });
}

export function mergePreviewFrames(
  existingFrames: VideoPreviewFrame[],
  incomingFrames: VideoPreviewFrame[]
): VideoPreviewFrame[] {
  if (existingFrames.length === 0) {
    return incomingFrames;
  }

  const incomingByKey = new Map(incomingFrames.map((frame) => [getPreviewFrameKey(frame), frame]));
  const mergedFrames = existingFrames.map((frame) => {
    const incoming = incomingByKey.get(getPreviewFrameKey(frame));

    if (!incoming) {
      return frame;
    }

    incomingByKey.delete(getPreviewFrameKey(frame));
    return {
      ...frame,
      thumbnail: incoming.thumbnail ?? frame.thumbnail,
      previewClip: incoming.previewClip ?? frame.previewClip
    };
  });

  return [...mergedFrames, ...incomingByKey.values()];
}

export function getPreviewFrameKey(frame: VideoPreviewFrame): string {
  return `${frame.batchId}:${frame.index}:${frame.timestampSeconds}`;
}
