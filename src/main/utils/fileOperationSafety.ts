import { lstat } from 'node:fs/promises';
import { basename, extname, isAbsolute } from 'node:path';
import { isSupportedVideoExtension } from '../../shared/constants/videoExtensions';
import type {
  FileIdentity,
  KnownPathKind,
  KnownPathValidationItem,
  KnownPathValidationResult
} from '../../shared/types/fileOperations';

export async function validateKnownPath(item: KnownPathValidationItem): Promise<KnownPathValidationResult> {
  const path = typeof item.path === 'string' ? item.path.trim() : '';
  const expectedKind = normalizeExpectedKind(item.expectedKind);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!path) {
    errors.push('A path is required.');
    return buildValidationResult({ item, path, expectedKind, exists: false, identity: null, warnings, errors });
  }

  if (!isAbsolute(path)) {
    errors.push('Path must be absolute.');
    return buildValidationResult({ item, path, expectedKind, exists: false, identity: null, warnings, errors });
  }

  try {
    const stats = await lstat(path);

    if (stats.isSymbolicLink()) {
      errors.push('Symbolic links are not supported for file-management actions.');
      return buildValidationResult({ item, path, expectedKind, exists: true, identity: null, warnings, errors });
    }

    const identity: FileIdentity = {
      path,
      fileName: basename(path),
      extension: extname(path).toLowerCase(),
      sizeBytes: stats.isFile() ? stats.size : null,
      modifiedAtMs: Number.isFinite(stats.mtimeMs) ? Math.round(stats.mtimeMs) : null,
      createdAtMs: Number.isFinite(stats.birthtimeMs) ? Math.round(stats.birthtimeMs) : null,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile()
    };

    if (expectedKind === 'file' && !identity.isFile) {
      errors.push('Path must point to a file.');
    }

    if (expectedKind === 'directory' && !identity.isDirectory) {
      errors.push('Path must point to a folder.');
    }

    if (item.expectedFileName && identity.fileName !== item.expectedFileName) {
      errors.push(`File name changed from ${item.expectedFileName} to ${identity.fileName}.`);
    }

    if (
      typeof item.expectedSizeBytes === 'number' &&
      Number.isFinite(item.expectedSizeBytes) &&
      identity.sizeBytes !== item.expectedSizeBytes
    ) {
      errors.push('File size no longer matches the expected value.');
    }

    if (
      typeof item.expectedModifiedAtMs === 'number' &&
      Number.isFinite(item.expectedModifiedAtMs) &&
      identity.modifiedAtMs !== Math.round(item.expectedModifiedAtMs)
    ) {
      errors.push('Modified timestamp no longer matches the expected value.');
    }

    if (item.requireSupportedVideoExtension && !isSupportedVideoExtension(identity.fileName)) {
      errors.push('File extension is not a supported video type.');
    }

    return buildValidationResult({ item, path, expectedKind, exists: true, identity, warnings, errors });
  } catch {
    errors.push('Path does not exist.');
    return buildValidationResult({ item, path, expectedKind, exists: false, identity: null, warnings, errors });
  }
}

export async function validateKnownPaths(items: KnownPathValidationItem[]): Promise<KnownPathValidationResult[]> {
  return Promise.all(items.map((item) => validateKnownPath(item)));
}

function buildValidationResult({
  item,
  path,
  expectedKind,
  exists,
  identity,
  warnings,
  errors
}: {
  item: KnownPathValidationItem;
  path: string;
  expectedKind: KnownPathKind;
  exists: boolean;
  identity: FileIdentity | null;
  warnings: string[];
  errors: string[];
}): KnownPathValidationResult {
  return {
    id: item.id,
    path,
    expectedKind,
    exists,
    isValid: errors.length === 0,
    identity,
    warnings,
    errors
  };
}

function normalizeExpectedKind(value: KnownPathKind | unknown): KnownPathKind {
  return value === 'file' || value === 'directory' || value === 'any' ? value : 'any';
}
