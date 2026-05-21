import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { runChildProcess } from '../utils/childProcess';

export interface OpenCvAvailabilityResult {
  ok: boolean;
  pythonPath: string;
  verifyScriptPath: string;
  command: string;
  versionLine: string | null;
  message: string;
  opencvVersion?: string;
  numpyVersion?: string;
  pythonVersion?: string;
  error?: string;
}

interface OpenCvVerifySuccessPayload {
  ok: true;
  opencvVersion: string;
  numpyVersion: string;
  pythonExecutable: string;
  pythonVersion: string;
}

interface OpenCvVerifyFailurePayload {
  ok: false;
  error: string;
  pythonExecutable?: string;
  pythonVersion?: string;
}

type OpenCvVerifyPayload = OpenCvVerifySuccessPayload | OpenCvVerifyFailurePayload;

export function getProjectPythonPath(): string {
  return join(process.cwd(), '.venv', 'bin', 'python');
}

export function getOpenCvFingerprintScriptPath(): string {
  return join(process.cwd(), 'scripts', 'opencv', 'fingerprint_video.py');
}

export function getOpenCvVerifyScriptPath(): string {
  return join(process.cwd(), 'scripts', 'opencv', 'verify_opencv.py');
}

export async function checkOpenCvAvailability(): Promise<OpenCvAvailabilityResult> {
  const pythonPath = getProjectPythonPath();
  const verifyScriptPath = getOpenCvVerifyScriptPath();
  const command = `${pythonPath} ${verifyScriptPath}`;

  try {
    await access(pythonPath);
  } catch {
    return {
      ok: false,
      pythonPath,
      verifyScriptPath,
      command,
      versionLine: null,
      message: `Project-local Python interpreter was not found at ${pythonPath}. Create .venv and run npm run opencv:install.`,
      error: 'Project-local Python interpreter is missing.'
    };
  }

  try {
    await access(verifyScriptPath);
  } catch {
    return {
      ok: false,
      pythonPath,
      verifyScriptPath,
      command,
      versionLine: null,
      message: `OpenCV verification helper was not found at ${verifyScriptPath}.`,
      error: 'OpenCV verification helper is missing.'
    };
  }

  const result = await runChildProcess(pythonPath, [verifyScriptPath]);
  const parsed = parseOpenCvVerifyPayload(result.stdout);

  if (!parsed.ok) {
    return {
      ok: false,
      pythonPath,
      verifyScriptPath,
      command,
      versionLine: getFirstLine(result.stdout || result.stderr),
      message: parsed.error || result.error || 'OpenCV verification did not return usable JSON.',
      error: parsed.error || result.error
    };
  }

  if (!parsed.payload.ok) {
    return {
      ok: false,
      pythonPath,
      verifyScriptPath,
      command,
      versionLine: parsed.payload.pythonVersion
        ? `Python ${parsed.payload.pythonVersion}`
        : getFirstLine(result.stdout || result.stderr),
      message: `OpenCV is unavailable in the project-local Python environment: ${parsed.payload.error}`,
      pythonVersion: parsed.payload.pythonVersion,
      error: parsed.payload.error
    };
  }

  const versionLine = `OpenCV ${parsed.payload.opencvVersion}, NumPy ${parsed.payload.numpyVersion}, Python ${parsed.payload.pythonVersion}`;

  return {
    ok: true,
    pythonPath,
    verifyScriptPath,
    command,
    versionLine,
    message: 'OpenCV is available in the project-local Python environment.',
    opencvVersion: parsed.payload.opencvVersion,
    numpyVersion: parsed.payload.numpyVersion,
    pythonVersion: parsed.payload.pythonVersion
  };
}

export function getOpenCvVisualModeUnavailableMessage(result: OpenCvAvailabilityResult): string {
  return `Visual Duplicate Scan modes require the project-local OpenCV helper before starting. ${result.message} Exact filename-only scans are still available.`;
}

function parseOpenCvVerifyPayload(
  stdout: string
): { ok: true; payload: OpenCvVerifyPayload } | { ok: false; error: string } {
  if (!stdout.trim()) {
    return { ok: false, error: 'OpenCV verification helper produced no JSON output.' };
  }

  try {
    const value = JSON.parse(stdout) as unknown;
    const payload = toOpenCvVerifyPayload(value);

    if (!payload) {
      return { ok: false, error: 'OpenCV verification helper returned an unexpected JSON shape.' };
    }

    return { ok: true, payload };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? `Failed to parse OpenCV verification JSON: ${error.message}`
          : 'Failed to parse OpenCV verification JSON.'
    };
  }
}

function toOpenCvVerifyPayload(value: unknown): OpenCvVerifyPayload | null {
  if (!isRecord(value) || typeof value.ok !== 'boolean') {
    return null;
  }

  if (!value.ok) {
    return {
      ok: false,
      error: readString(value.error) || 'OpenCV verification failed.',
      pythonExecutable: readOptionalString(value.pythonExecutable) ?? undefined,
      pythonVersion: readOptionalString(value.pythonVersion) ?? undefined
    };
  }

  const opencvVersion = readString(value.opencvVersion);
  const numpyVersion = readString(value.numpyVersion);
  const pythonExecutable = readString(value.pythonExecutable);
  const pythonVersion = readString(value.pythonVersion);

  if (!opencvVersion || !numpyVersion || !pythonExecutable || !pythonVersion) {
    return null;
  }

  return {
    ok: true,
    opencvVersion,
    numpyVersion,
    pythonExecutable,
    pythonVersion
  };
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function readOptionalString(value: unknown): string | null {
  return value === undefined || value === null ? null : readString(value);
}

function getFirstLine(value: string): string | null {
  const line = value.split(/\r?\n/).map((entry) => entry.trim()).find(Boolean);
  return line ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
