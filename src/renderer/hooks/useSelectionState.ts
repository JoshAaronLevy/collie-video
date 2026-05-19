import { useCallback, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { VideoRow } from '../../shared/types/video';

export interface UseSelectionStateValue {
  selectedVideos: VideoRow[];
  setSelectedVideos: Dispatch<SetStateAction<VideoRow[]>>;
  clearSelectedVideos: () => void;
  selectedVideoCount: number;
  selectedPaths: string[];
}

export function useSelectionState(): UseSelectionStateValue {
  const [selectedVideos, setSelectedVideos] = useState<VideoRow[]>([]);

  const clearSelectedVideos = useCallback((): void => {
    setSelectedVideos([]);
  }, []);
  const selectedPaths = useMemo(
    () => selectedVideos.map((video) => video.path),
    [selectedVideos]
  );

  return {
    selectedVideos,
    setSelectedVideos,
    clearSelectedVideos,
    selectedVideoCount: selectedVideos.length,
    selectedPaths
  };
}
