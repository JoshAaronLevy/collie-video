import type { ToolDiagnosticItem, ToolDiagnosticsResult } from '../../shared/types/diagnostics';
import { runChildProcess } from '../utils/childProcess';
import { checkOpenCvAvailability, getProjectPythonPath } from './opencvToolService';
import { getSettings } from './settingsService';

export async function checkMediaToolAvailability(): Promise<ToolDiagnosticsResult> {
  const settings = await getSettings();
  const [ffmpeg, ffprobe, python, openCv] = await Promise.all([
    checkTool('ffmpeg', settings.ffmpegPathOverride?.trim() || 'ffmpeg'),
    checkTool('ffprobe', settings.ffprobePathOverride?.trim() || 'ffprobe'),
    checkTool('python', getProjectPythonPath(), ['--version']),
    checkOpenCvTool()
  ]);
  const tools = [ffmpeg, ffprobe, python, openCv];

  const failedCount = tools.filter((tool) => !tool.ok).length;

  return {
    status: 'complete',
    checkedAt: new Date().toISOString(),
    tools,
    message:
      failedCount === 0
        ? 'ffmpeg, ffprobe, and local OpenCV are available.'
        : `${failedCount.toLocaleString()} media tool(s) could not be reached.`
  };
}

async function checkTool(
  name: ToolDiagnosticItem['name'],
  command: string,
  args: string[] = ['-version']
): Promise<ToolDiagnosticItem> {
  const result = await runChildProcess(command, args);
  const versionLine = getFirstLine(result.stdout || result.stderr);

  if (!result.ok) {
    return {
      name,
      command,
      ok: false,
      versionLine,
      message: result.error || `${name} could not be reached.`
    };
  }

  return {
    name,
    command,
    ok: true,
    versionLine,
    message: `${name} is available.`
  };
}

async function checkOpenCvTool(): Promise<ToolDiagnosticItem> {
  const result = await checkOpenCvAvailability();

  return {
    name: 'opencv',
    command: result.command,
    ok: result.ok,
    versionLine: result.versionLine,
    message: result.message
  };
}

function getFirstLine(value: string): string | null {
  const line = value.split(/\r?\n/).map((entry) => entry.trim()).find(Boolean);
  return line ?? null;
}
