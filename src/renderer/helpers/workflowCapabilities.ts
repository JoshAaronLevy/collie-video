export interface WorkflowCapabilityInput {
  isAnyBlockingWorkflowActive: boolean;
  selectedFolderCount: number;
  selectedFileCount: number;
  includeLowResolutionAnalysis: boolean;
  includeBlackBorderAnalysis: boolean;
  hasLastAuditRequest: boolean;
  selectedVideoCount: number;
  visibleVideoRowCount: number;
  hasAuditedRootDirectory: boolean;
  hasVideoRows: boolean;
  premiereStatus: string | null;
}

export interface WorkflowCapabilities {
  canRunAudit: boolean;
  canRefreshAudit: boolean;
  canAutoFixSelected: boolean;
  canOpenCropOptions: boolean;
  canGenerateThumbnails: boolean;
  canMoveSelectedToTrash: boolean;
  canMoveSelectedToFolder: boolean;
  canArchiveSelectedOriginals: boolean;
  canStartMigration: boolean;
  canEditSelectedInPremiere: boolean;
}

export function getWorkflowCapabilities({
  isAnyBlockingWorkflowActive,
  selectedFolderCount,
  selectedFileCount,
  includeLowResolutionAnalysis,
  includeBlackBorderAnalysis,
  hasLastAuditRequest,
  selectedVideoCount,
  visibleVideoRowCount,
  hasAuditedRootDirectory,
  hasVideoRows,
  premiereStatus
}: WorkflowCapabilityInput): WorkflowCapabilities {
  const hasSelectedSource = selectedFolderCount > 0 || selectedFileCount > 0;
  const hasAuditOption = includeLowResolutionAnalysis || includeBlackBorderAnalysis;
  const hasSelectedVideos = selectedVideoCount > 0;

  return {
    canRunAudit: !isAnyBlockingWorkflowActive && hasSelectedSource && hasAuditOption,
    canRefreshAudit: hasLastAuditRequest && !isAnyBlockingWorkflowActive,
    canAutoFixSelected: hasSelectedVideos && !isAnyBlockingWorkflowActive,
    canOpenCropOptions: hasSelectedVideos && !isAnyBlockingWorkflowActive,
    canGenerateThumbnails: visibleVideoRowCount > 0 && !isAnyBlockingWorkflowActive,
    canMoveSelectedToTrash: hasSelectedVideos && !isAnyBlockingWorkflowActive,
    canMoveSelectedToFolder: hasSelectedVideos && !isAnyBlockingWorkflowActive,
    canArchiveSelectedOriginals: hasSelectedVideos && !isAnyBlockingWorkflowActive,
    canStartMigration: hasAuditedRootDirectory && hasVideoRows && !isAnyBlockingWorkflowActive,
    canEditSelectedInPremiere:
      hasSelectedVideos && premiereStatus === 'ready' && !isAnyBlockingWorkflowActive
  };
}
