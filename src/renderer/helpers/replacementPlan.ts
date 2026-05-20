import type { AutoCropResult } from '../../shared/types/autoCrop';
import type { AutoFixResult } from '../../shared/types/autoFix';
import type {
  ReplacementExecutionAction,
  ReplacementPlan,
  ReplacementPlanActionUpdate,
  ReplacementPlanBulkAction
} from '../../shared/types/replacementWorkflow';
import type { AppSettings } from '../../shared/types/settings';

const TEN_GB_BYTES = 10 * 1024 * 1024 * 1024;

export function hasSuccessfulConversionOutputs(result: AutoFixResult | AutoCropResult | null): boolean {
  return Boolean(
    result?.items.some((item) => item.status === 'success' && Boolean(item.outputPath))
  );
}

export function getReplacementBulkActionUpdates(
  plan: ReplacementPlan,
  action: ReplacementPlanBulkAction
): ReplacementPlanActionUpdate[] {
  if (action === 'ready-replace') {
    return plan.items
      .filter((item) => item.status === 'ready')
      .map((item) => ({
        itemId: item.id,
        selectedAction: 'replace-original'
      }));
  }

  if (action === 'ready-trash') {
    return plan.items
      .filter((item) => item.status === 'ready')
      .map((item) => ({
        itemId: item.id,
        selectedAction: 'trash-original'
      }));
  }

  if (action === 'warning-skip') {
    return plan.items
      .filter((item) => item.status === 'warning')
      .map((item) => ({
        itemId: item.id,
        selectedAction: 'skip'
      }));
  }

  if (action === 'keep-output') {
    return plan.items.map((item) => ({
      itemId: item.id,
      selectedAction: 'keep-output'
    }));
  }

  return plan.items.map((item) => ({
    itemId: item.id,
    selectedAction: 'skip'
  }));
}

export function getReplacementBulkActionMessage(action: ReplacementPlanBulkAction): string {
  if (action === 'ready-replace') {
    return 'Ready items were set to replace originals.';
  }

  if (action === 'ready-trash') {
    return 'Ready items were set to move originals to Trash.';
  }

  if (action === 'warning-skip') {
    return 'Warning items were set to skip.';
  }

  if (action === 'keep-output') {
    return 'All items were set to keep outputs.';
  }

  return 'Replacement actions were cleared.';
}

export function getExecutableReplacementItemCount(
  plan: ReplacementPlan,
  actionOverride?: ReplacementExecutionAction | null
): number {
  return getExecutableReplacementItems(plan, actionOverride).length;
}

export function requiresReplacementConfirmation(
  plan: ReplacementPlan,
  settings: AppSettings | null,
  actionOverride?: ReplacementExecutionAction | null
): boolean {
  const executableItems = getExecutableReplacementItems(plan, actionOverride);
  const thresholds = getReplacementConfirmationThresholds(settings);

  return (
    executableItems.length > thresholds.fileCount ||
    executableItems.reduce((total, item) => total + (item.originalSizeBytes ?? 0), 0) > thresholds.sizeBytes ||
    executableItems.some((item) => item.warnings.length > 0) ||
    plan.summary.destinationConflicts > 0 ||
    executableItems.some((item) => isExternalVolumePath(item.originalPath) || isExternalVolumePath(item.outputPath)) ||
    executableItems.some((item) => item.warningCodes.includes('extension-changed'))
  );
}

export function getReplacementConfirmationThresholds(settings: AppSettings | null): { fileCount: number; sizeBytes: number } {
  if (!settings?.requireTypedConfirmationForLargeOperations) {
    return {
      fileCount: 10,
      sizeBytes: TEN_GB_BYTES
    };
  }

  return {
    fileCount: Math.min(10, Math.max(1, settings.typedConfirmationFileCountThreshold)),
    sizeBytes: Math.min(TEN_GB_BYTES, Math.max(1024 * 1024, settings.typedConfirmationSizeThresholdBytes))
  };
}

export function getExecutableReplacementItems(
  plan: ReplacementPlan,
  actionOverride?: ReplacementExecutionAction | null
): ReplacementPlan['items'] {
  return plan.items.filter((item) => {
    const action = actionOverride ?? item.selectedAction;

    return (
      (action === 'replace-original' || action === 'trash-original') &&
      (item.status === 'ready' || item.status === 'warning')
    );
  });
}

export function isExternalVolumePath(path: string): boolean {
  return path.startsWith('/Volumes/');
}
