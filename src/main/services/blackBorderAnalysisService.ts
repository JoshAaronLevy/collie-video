import type {
  AspectRatioBox,
  BlackBorderAdjustment,
  BlackBorderClassification,
  BlackBorderConfidence,
  BorderPixels,
  CropRectangle
} from '../../shared/types/video';
import { runChildProcess } from '../utils/childProcess';

const SAMPLE_FRACTIONS = [0.1, 0.25, 0.5, 0.75, 0.9];
const CROPDETECT_LIMIT = 24;
const CROPDETECT_ROUND = 2;
const CROPDETECT_SECONDS = 2;
const MIN_BORDER_PIXELS = 12;
const MIN_BORDER_RATIO = 0.006;
const RECT_AGREEMENT_PIXELS = 8;
const ASPECT_RATIO_16_9 = 16 / 9;
const AUTO_CROP_ASPECT_TOLERANCE = 0.03;
const MIN_VISIBLE_WIDTH = 640;
const MIN_VISIBLE_HEIGHT = 360;
const DEFAULT_TARGET_WIDTH = 1920;
const DEFAULT_TARGET_HEIGHT = 1080;

interface AnalyzeBlackBordersOptions {
  filePath: string;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  ffmpegPath?: string | null;
  signal?: AbortSignal;
}

interface CropdetectCrop {
  width: number;
  height: number;
  x: number;
  y: number;
}

interface CropdetectSample {
  timestampSeconds: number;
  crop: CropdetectCrop;
}

type CropdetectSampleResult =
  | {
      ok: true;
      timestampSeconds: number;
      crop: CropdetectCrop;
    }
  | {
      ok: false;
      timestampSeconds: number;
      canceled?: boolean;
      error: string;
    };

interface CropCluster {
  crop: CropdetectCrop;
  samples: CropdetectSample[];
}

export async function analyzeBlackBorders({
  filePath,
  width,
  height,
  durationSeconds,
  ffmpegPath,
  signal
}: AnalyzeBlackBordersOptions): Promise<BlackBorderAdjustment> {
  const sourceWidth = safeNumber(width);
  const sourceHeight = safeNumber(height);
  const duration = safeNumber(durationSeconds);

  if (!filePath || !sourceWidth || !sourceHeight) {
    return createAnalysisError({
      width: sourceWidth,
      height: sourceHeight,
      durationSeconds: duration,
      message: 'Source dimensions are unavailable.'
    });
  }

  const timestamps = getSampleTimestamps(duration);
  const binaryPath = ffmpegPath?.trim() || 'ffmpeg';
  const sampleResults: CropdetectSampleResult[] = [];

  for (const timestampSeconds of timestamps) {
    throwIfAborted(signal);

    const result = await runCropdetectSample({
      filePath,
      timestampSeconds,
      ffmpegPath: binaryPath,
      signal
    });

    if (!result.ok && result.canceled) {
      throw createBlackBorderCancelError();
    }

    sampleResults.push(result);
  }

  const successfulSamples = sampleResults
    .filter((sample): sample is Extract<CropdetectSampleResult, { ok: true }> => sample.ok)
    .map(({ timestampSeconds, crop }) => ({
      timestampSeconds,
      crop
  }));

  if (successfulSamples.length === 0) {
    const firstFailedSample = sampleResults.find(
      (sample): sample is Extract<CropdetectSampleResult, { ok: false }> => !sample.ok
    );

    return createAnalysisError({
      width: sourceWidth,
      height: sourceHeight,
      durationSeconds: duration,
      message: firstFailedSample?.error || 'No cropdetect samples succeeded.'
    });
  }

  const dominant = getDominantCrop(successfulSamples);

  if (!dominant) {
    return createAnalysisError({
      width: sourceWidth,
      height: sourceHeight,
      durationSeconds: duration,
      message: 'No dominant cropdetect rectangle could be determined.'
    });
  }

  const crop = dominant.crop;
  const borders = calculateBorders(crop, sourceWidth, sourceHeight);
  const sourceAspectRatio = sourceWidth / sourceHeight;
  const visibleAspectRatio = crop.width / crop.height;
  const blackFrameEstimate =
    1 - (crop.width * crop.height) / (sourceWidth * sourceHeight);
  const classification = classifyBorders({
    borders,
    sourceWidth,
    sourceHeight,
    crop
  });
  const visibleArea: CropRectangle = {
    width: crop.width,
    height: crop.height,
    x: crop.x,
    y: crop.y,
    aspectRatio: roundNumber(visibleAspectRatio),
    aspectRatioLabel: getAspectRatioLabel(visibleAspectRatio)
  };
  const confidence = getConfidence(dominant.samples.length);
  const detected = classification !== 'clean' && classification !== 'uncertain';
  const eligible = isAutoCropEligible({
    classification,
    confidence,
    visibleArea
  });

  return {
    analyzed: true,
    detected,
    classification,
    confidence,
    source: createAspectRatioBox(sourceWidth, sourceHeight, sourceAspectRatio),
    visibleArea,
    borders,
    borderPercent: {
      left: roundNumber((borders.left / sourceWidth) * 100, 3),
      right: roundNumber((borders.right / sourceWidth) * 100, 3),
      top: roundNumber((borders.top / sourceHeight) * 100, 3),
      bottom: roundNumber((borders.bottom / sourceHeight) * 100, 3),
      blackFrameEstimate: roundNumber(blackFrameEstimate * 100, 3)
    },
    durationSeconds: duration,
    samples: successfulSamples,
    sampleAgreement: {
      matchingSamples: dominant.samples.length,
      totalSamples: timestamps.length,
      successfulSamples: successfulSamples.length
    },
    recommendedFix: getRecommendedFix(classification, eligible)
  };
}

export function isHighConfidenceNestedBorderCandidate(
  blackBorder: BlackBorderAdjustment | null | undefined
): boolean {
  return Boolean(
    blackBorder &&
      blackBorder.analyzed &&
      blackBorder.classification === 'nested_borders' &&
      blackBorder.confidence === 'high'
  );
}

export function isBlackBorderReviewCandidate(
  blackBorder: BlackBorderAdjustment | null | undefined
): boolean {
  return Boolean(
    blackBorder &&
      blackBorder.analyzed &&
      (blackBorder.classification === 'nested_borders' ||
        blackBorder.classification === 'asymmetric_border' ||
        blackBorder.classification === 'pillarboxed' ||
        blackBorder.classification === 'letterboxed' ||
        blackBorder.classification === 'uncertain' ||
        blackBorder.classification === 'analysis_error')
  );
}

export function getBlackBorderReviewReason(
  blackBorder: BlackBorderAdjustment | null | undefined
): string | null {
  if (!isBlackBorderReviewCandidate(blackBorder)) {
    return null;
  }

  switch (blackBorder?.classification) {
    case 'nested_borders':
      return 'black borders detected on both axes';
    case 'asymmetric_border':
      return 'asymmetric black borders detected';
    case 'pillarboxed':
      return 'pillarbox borders detected';
    case 'letterboxed':
      return 'letterbox borders detected';
    case 'uncertain':
      return 'black-border analysis uncertain';
    case 'analysis_error':
      return 'black-border analysis errored';
    default:
      return null;
  }
}

async function runCropdetectSample({
  filePath,
  timestampSeconds,
  ffmpegPath,
  signal
}: {
  filePath: string;
  timestampSeconds: number;
  ffmpegPath: string;
  signal?: AbortSignal;
}): Promise<CropdetectSampleResult> {
  if (signal?.aborted) {
    return {
      ok: false,
      canceled: true,
      timestampSeconds,
      error: 'Audit canceled.'
    };
  }

  const args = [
    '-hide_banner',
    '-nostdin',
    '-ss',
    String(timestampSeconds),
    '-i',
    filePath,
    '-t',
    String(CROPDETECT_SECONDS),
    '-vf',
    `cropdetect=limit=${CROPDETECT_LIMIT}:round=${CROPDETECT_ROUND}:reset=0`,
    '-f',
    'null',
    '-'
  ];
  const result = await runChildProcess(ffmpegPath, args, { signal });

  if (result.canceled) {
    return {
      ok: false,
      canceled: true,
      timestampSeconds,
      error: 'Audit canceled.'
    };
  }

  if (!result.ok) {
    return {
      ok: false,
      timestampSeconds,
      error: result.error || result.stderr || `ffmpeg exited with code ${result.code}`
    };
  }

  const crop = parseCropdetectOutput(result.stderr);

  if (!crop) {
    return {
      ok: false,
      timestampSeconds,
      error: 'No cropdetect crop value was emitted.'
    };
  }

  return {
    ok: true,
    timestampSeconds,
    crop
  };
}

function parseCropdetectOutput(stderr: string): CropdetectCrop | null {
  const matches = Array.from(stderr.matchAll(/crop=(\d+):(\d+):(\d+):(\d+)/g));

  if (matches.length === 0) {
    return null;
  }

  const [, width, height, x, y] = matches[matches.length - 1];

  return {
    width: Number(width),
    height: Number(height),
    x: Number(x),
    y: Number(y)
  };
}

function getSampleTimestamps(durationSeconds: number | null): number[] {
  const duration = safeNumber(durationSeconds);

  if (!duration || duration <= 0) {
    return SAMPLE_FRACTIONS.map(() => 0);
  }

  const maxSeek = Math.max(0, duration - 0.25);

  return SAMPLE_FRACTIONS.map((fraction) =>
    roundNumber(Math.min(maxSeek, Math.max(0, duration * fraction)), 3)
  );
}

function rectanglesAgree(first: CropdetectCrop, second: CropdetectCrop): boolean {
  return (
    Math.abs(first.width - second.width) <= RECT_AGREEMENT_PIXELS &&
    Math.abs(first.height - second.height) <= RECT_AGREEMENT_PIXELS &&
    Math.abs(first.x - second.x) <= RECT_AGREEMENT_PIXELS &&
    Math.abs(first.y - second.y) <= RECT_AGREEMENT_PIXELS
  );
}

function getDominantCrop(samples: CropdetectSample[]): CropCluster | null {
  const clusters: CropCluster[] = [];

  for (const sample of samples) {
    const existingCluster = clusters.find((cluster) =>
      rectanglesAgree(cluster.crop, sample.crop)
    );

    if (existingCluster) {
      existingCluster.samples.push(sample);
      continue;
    }

    clusters.push({
      crop: sample.crop,
      samples: [sample]
    });
  }

  clusters.sort((first, second) => second.samples.length - first.samples.length);

  return clusters[0] ?? null;
}

function calculateBorders(
  crop: CropdetectCrop,
  sourceWidth: number,
  sourceHeight: number
): BorderPixels {
  return {
    left: crop.x,
    right: Math.max(0, sourceWidth - crop.x - crop.width),
    top: crop.y,
    bottom: Math.max(0, sourceHeight - crop.y - crop.height)
  };
}

function getConfidence(agreementCount: number): BlackBorderConfidence {
  if (agreementCount >= 4) {
    return 'high';
  }

  if (agreementCount >= 3) {
    return 'medium';
  }

  return 'low';
}

function getBorderThreshold(frameSize: number): number {
  return Math.max(MIN_BORDER_PIXELS, Math.round(frameSize * MIN_BORDER_RATIO));
}

function classifyBorders({
  borders,
  sourceWidth,
  sourceHeight,
  crop
}: {
  borders: BorderPixels;
  sourceWidth: number;
  sourceHeight: number;
  crop: CropdetectCrop;
}): BlackBorderClassification {
  const horizontalThreshold = getBorderThreshold(sourceWidth);
  const verticalThreshold = getBorderThreshold(sourceHeight);
  const hasLeft = borders.left >= horizontalThreshold;
  const hasRight = borders.right >= horizontalThreshold;
  const hasTop = borders.top >= verticalThreshold;
  const hasBottom = borders.bottom >= verticalThreshold;
  const hasSideBorder = hasLeft || hasRight;
  const hasVerticalBorder = hasTop || hasBottom;
  const sideIsSymmetric = hasLeft === hasRight;
  const verticalIsSymmetric = hasTop === hasBottom;
  const blackFrameEstimate =
    1 - (crop.width * crop.height) / (sourceWidth * sourceHeight);

  if (!hasSideBorder && !hasVerticalBorder) {
    return blackFrameEstimate <= 0.01 ? 'clean' : 'uncertain';
  }

  if (hasLeft && hasRight && !hasVerticalBorder) {
    return 'pillarboxed';
  }

  if (hasTop && hasBottom && !hasSideBorder) {
    return 'letterboxed';
  }

  if (hasSideBorder && hasVerticalBorder && sideIsSymmetric && verticalIsSymmetric) {
    return 'nested_borders';
  }

  return 'asymmetric_border';
}

function isAutoCropEligible({
  classification,
  confidence,
  visibleArea
}: {
  classification: BlackBorderClassification;
  confidence: BlackBorderConfidence;
  visibleArea: CropRectangle;
}): boolean {
  if (classification !== 'nested_borders' || confidence !== 'high') {
    return false;
  }

  return (
    Math.abs(visibleArea.aspectRatio - ASPECT_RATIO_16_9) <= AUTO_CROP_ASPECT_TOLERANCE &&
    visibleArea.width >= MIN_VISIBLE_WIDTH &&
    visibleArea.height >= MIN_VISIBLE_HEIGHT
  );
}

function getRecommendedFix(
  classification: BlackBorderClassification,
  eligible: boolean
): NonNullable<BlackBorderAdjustment['recommendedFix']> {
  if (eligible) {
    return {
      eligible: true,
      type: 'crop-scale',
      targetWidth: DEFAULT_TARGET_WIDTH,
      targetHeight: DEFAULT_TARGET_HEIGHT,
      reason: 'High-confidence nested borders with visible area close to 16:9.'
    };
  }

  if (classification === 'clean') {
    return {
      eligible: false,
      type: 'none',
      reason: 'No black borders detected.'
    };
  }

  return {
    eligible: false,
    type: 'manual-review',
    reason:
      classification === 'nested_borders'
        ? 'Nested borders need manual review because confidence or visible aspect ratio is outside the auto-crop target.'
        : 'No high-confidence 16:9 nested-border auto-crop candidate was detected.'
  };
}

function createAnalysisError({
  width,
  height,
  durationSeconds,
  message
}: {
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  message: string;
}): BlackBorderAdjustment {
  const source =
    width && height ? createAspectRatioBox(width, height, width / height) : undefined;

  return {
    analyzed: true,
    detected: false,
    classification: 'analysis_error',
    confidence: 'low',
    error: message,
    source,
    durationSeconds,
    samples: [],
    recommendedFix: {
      eligible: false,
      type: 'manual-review',
      reason: 'Black-border analysis could not be completed.'
    }
  };
}

function createAspectRatioBox(
  width: number,
  height: number,
  aspectRatio: number
): AspectRatioBox {
  return {
    width,
    height,
    aspectRatio: roundNumber(aspectRatio),
    aspectRatioLabel: getAspectRatioLabel(aspectRatio)
  };
}

function getAspectRatioLabel(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return '';
  }

  const knownRatios = [
    { label: '16:9', value: 16 / 9 },
    { label: '4:3', value: 4 / 3 },
    { label: '9:16', value: 9 / 16 },
    { label: '1:1', value: 1 },
    { label: '21:9', value: 21 / 9 }
  ];
  const match = knownRatios.find(
    (candidate) => Math.abs(ratio - candidate.value) <= 0.03
  );

  return match ? match.label : ratio.toFixed(3);
}

function safeNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function roundNumber(value: number, fractionDigits = 6): number {
  return Number(value.toFixed(fractionDigits));
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw createBlackBorderCancelError();
  }
}

function createBlackBorderCancelError(): Error {
  const error = new Error('Audit canceled.');
  error.name = 'AbortError';
  return error;
}
