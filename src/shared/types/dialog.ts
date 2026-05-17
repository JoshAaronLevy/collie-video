export type PathKind = 'file' | 'directory' | 'any';

export interface PathValidationResult {
  path: string;
  expected: PathKind;
  exists: boolean;
  isValid: boolean;
  reason?: string;
}

export interface PathSelectionResult {
  canceled: boolean;
  paths: string[];
  invalidPaths: PathValidationResult[];
}

export interface RevealPathResult {
  ok: boolean;
  path: string;
  message?: string;
}
