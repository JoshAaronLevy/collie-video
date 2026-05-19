import type { AuditOptions } from '../../shared/types/audit';
import type { AppSettings } from '../../shared/types/settings';

export const DEFAULT_AUDIT_OPTIONS: AuditOptions = {
  includeSubfolders: true,
  includeLowResolutionAnalysis: true,
  includeBlackBorderAnalysis: true,
  minHeight: 720,
  targetAspectRatio: 16 / 9,
  aspectRatioTolerance: 0.01
};

export function settingsToAuditOptions(settings: AppSettings): AuditOptions {
  return {
    ...DEFAULT_AUDIT_OPTIONS,
    includeSubfolders: settings.includeSubfoldersDefault,
    includeLowResolutionAnalysis: settings.lowResolutionAnalysisEnabledDefault,
    includeBlackBorderAnalysis: settings.blackBorderAnalysisEnabledDefault
  };
}
