import type {
  FolderTreeScanStatus,
  FolderTreeSkipReason
} from '../types/folderTree';

export const DEFAULT_FOLDER_TREE_ROOT_PATH = '/Volumes/SanDisk SSD/Videos/Edited';
export const DEFAULT_FOLDER_TREE_ROOT_LABEL = 'SanDisk Edited Videos';
export const MAX_FOLDER_TREE_DISPLAY_PATH_LENGTH = 96;

export const FOLDER_TREE_SCAN_STATUSES = [
  'idle',
  'scanning',
  'complete',
  'canceled',
  'error'
] as const satisfies readonly FolderTreeScanStatus[];

export const FOLDER_TREE_SKIP_REASONS = [
  'system-folder',
  'app-temp-folder',
  'symlink',
  'unreadable',
  'invalid-root'
] as const satisfies readonly FolderTreeSkipReason[];

export const FOLDER_TREE_SKIPPED_FILE_NAMES = ['.DS_Store'] as const;
export const FOLDER_TREE_SKIPPED_FILE_PREFIXES = ['._'] as const;

export const FOLDER_TREE_SKIPPED_SYSTEM_FOLDER_NAMES = [
  '.Spotlight-V100',
  '.Trashes',
  '.fseventsd',
  '.TemporaryItems',
  'System Volume Information',
  '.git',
  'node_modules'
] as const;

export const FOLDER_TREE_SKIPPED_APP_FOLDER_NAMES = [
  '.video-audit-temp',
  '.video-audit-trash',
  '.video-audit-cleanup-runs',
  '.collie-video-temp',
  '.collie-video-trash',
  '.collie-video-cleanup-runs',
  'Archive',
  'archived-files'
] as const;

export const FOLDER_TREE_SKIPPED_FOLDER_NAMES = [
  ...FOLDER_TREE_SKIPPED_SYSTEM_FOLDER_NAMES,
  ...FOLDER_TREE_SKIPPED_APP_FOLDER_NAMES
] as const;
