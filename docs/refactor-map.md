# Renderer Refactor Map

This map reflects the current renderer after Stage 1 pure-helper extraction. The main renderer orchestration surface is still `src/renderer/hooks/useVideoAuditAppController.ts`, while pure helper blocks now live under `src/renderer/helpers/`.

## Current Controller Responsibilities

`useVideoAuditAppController.ts` still acts as the renderer composition and workflow controller. It owns the public flat controller shape consumed by `src/renderer/App.tsx`, most workflow state, progress subscriptions, dialog visibility flags, row mutation callbacks, and direct calls through `window.videoAudit`.

By domain, the controller currently owns:

- App bootstrap and app info: loads app metadata through `window.videoAudit.app.getInfo`, stores app-info errors, and exposes menu-driven open counters.
- Settings: loads settings on startup, persists partial updates, resets settings, maps settings into audit options, updates source/output defaults, and stores settings messages.
- Diagnostics: runs media tool diagnostics and stores diagnostics result/error/loading state.
- Source selection: stores selected folders, folder-tree summary/root/last-scan metadata, selected files, output folder, selection messages, recent-path persistence, source clearing, and folder-tree selection application.
- Audit options: stores audit option flags and thresholds, updates settings-backed defaults, and validates that at least one analysis mode is enabled.
- Audit execution and progress: starts audits, refreshes from `lastAuditRequest`, cancels active audit jobs, subscribes to progress, applies completed results, and exposes audit percent.
- Discovery: starts/cancels file discovery, subscribes to progress, and derives discovered paths.
- FFprobe metadata: starts/cancels metadata extraction from discovered paths, subscribes to progress, and exposes metadata items.
- Result persistence and rows: restores IndexedDB audit data, applies audit results, persists current results, tracks storage messages/saved time, stores raw and visible rows, and owns row hiding/restoring.
- Result filtering: stores top-level results view filter and global filter, derives view counts and filtered rows. PrimeReact column filters remain local inside `VideoResultsTable`.
- Row selection: stores `selectedVideos`, exposes `setSelectedVideos`, clears selection when results reset or paths are hidden, and passes selected rows into workflows.
- Capability flags and busy state: derives many `is...Active` and `can...` booleans from `activeAction`, job progress, selection, source state, and Premiere status.
- Path reveal/validation: validates arbitrary paths through file-operation validation and reveals known files/folders through typed preload methods.
- Auto-Fix: stores dialog/progress/result/error/job state, validates selected rows and output directory, starts/cancels jobs, hides successful source rows, and triggers post-conversion planning.
- Auto-Crop: stores dialog/progress/result/error/job state, validates selected rows and output directory, starts/cancels jobs, and triggers post-conversion planning.
- Media preview: stores thumbnail dialog scope/progress/result/error/job state, starts/cancels thumbnail generation, merges thumbnail results into rows, and persists row updates.
- Fresh preview frames: tracks one fetch path/error, generates fresh frames for one row, merges the returned preview item into rows and current selection, and persists.
- Preview clips: stores clip progress/result/error/job state, starts/cancels clip generation, merges generated clip metadata into rows, and persists.
- Migration: stores scan/execute dialog state, selected new-edits folder, scan/result/progress/error/job state, starts scan/execute workflows, and reacts to migration progress.
- Trash file operation: creates trash plans, opens confirm/result dialogs, executes plans, hides successful source rows, and optionally opens operation history after result close.
- Move file operation: prompts for destination, creates move plans, opens confirm/result dialogs, executes plans, hides successful source rows, and optionally opens operation history after result close.
- Archive file operation: creates archive plans, opens confirm/result dialogs, executes plans, hides successful source rows, and optionally opens operation history after result close.
- Post-conversion replacement: creates replacement plans from Auto-Fix/Auto-Crop results, manages review/choice dialog state, updates item/bulk actions, validates typed confirmation, starts/cancels replacement execution, hides replaced originals, and optionally opens operation history after result close.
- Operation history: opens/closes the history dialog, loads recent records, refreshes the list, loads record details, stores selected record and errors.
- Premiere bridge: loads initial status, refreshes status, opens bridge apps, submits selected videos for import, updates import result/error state, hides imported rows, and refreshes status after import.
- App menu commands: subscribes to app commands and routes choose-folder, choose-files, refresh-audit, cancel-active, and open-settings commands.
- Escape-key handling: installs a global Escape listener that routes through the same cancel-active command path.
- Cache/data clearing: saves scan metadata to history when possible, clears media-preview cache and IndexedDB current audit data, updates settings fields, and resets almost every workflow state bucket.

## State Variables by Workflow

- App/bootstrap: `appInfo`, `appInfoMessage`, `settingsOpenRequestCount`, `folderTreeOpenRequestCount`.
- Settings: `settings`, `settingsMessage`.
- Diagnostics: `toolDiagnostics`, `toolDiagnosticsError`, `isToolDiagnosticsLoading`.
- Shared messages/busy marker: `selectionMessage`, `workflowMessage`, `activeAction`.
- Sources: `selectedFolders`, `selectedFolderSummary`, `folderTreeRootPath`, `folderTreeLastScannedAt`, `selectedFiles`, `outputFolder`.
- Audit options and execution: `auditOptions`, `auditJobId`, `auditProgress`, `pendingAuditRequestRef`.
- Audit results and storage: `auditResult`, `auditSummary`, `auditErrors`, `videoRows`, `showThumbnailsState`, `isStorageLoading`, `storageMessage`, `storageSavedAt`, `lastAuditRequest`.
- Row selection/filtering: `selectedVideos`, `globalFilter`, `resultsViewFilter`.
- Discovery: `discoveryJobId`, `discoveryProgress`.
- FFprobe: `ffprobeJobId`, `ffprobeProgress`.
- Auto-Fix: `autoFixJobId`, `autoFixProgress`, `autoFixResult`, `autoFixError`, `isAutoFixDialogVisible`.
- Auto-Crop: `autoCropJobId`, `autoCropProgress`, `autoCropResult`, `autoCropError`, `isAutoCropDialogVisible`.
- Media preview: `mediaPreviewJobId`, `mediaPreviewProgress`, `mediaPreviewResult`, `mediaPreviewError`, `mediaPreviewScope`, `isThumbnailDialogVisible`.
- Preview clips and fresh frames: `previewClipJobId`, `previewClipProgress`, `previewClipResult`, `previewClipError`, `previewFrameFetchPath`, `previewFrameError`.
- Migration: `migrationNewEditedDir`, `migrationScan`, `migrationScanError`, `migrationJobId`, `migrationProgress`, `migrationResult`, `migrationResultError`, `isMigrationScanDialogVisible`, `isMigrationResultDialogVisible`.
- Trash: `trashPlan`, `trashPlanError`, `trashResult`, `trashResultError`, `isTrashConfirmDialogVisible`, `isTrashResultDialogVisible`.
- Move: `movePlan`, `movePlanError`, `moveResult`, `moveResultError`, `isMoveConfirmDialogVisible`, `isMoveResultDialogVisible`.
- Archive: `archivePlan`, `archivePlanError`, `archiveResult`, `archiveResultError`, `isArchiveConfirmDialogVisible`, `isArchiveResultDialogVisible`.
- Replacement/post-conversion: `postConversionPlan`, `postConversionSourceLabel`, `postConversionMode`, `postConversionError`, `postConversionMessage`, `isPostConversionDialogVisible`, `replacementJobId`, `replacementProgress`, `replacementResult`, `replacementResultError`, `isReplacementResultDialogVisible`.
- Operation history: `operationHistoryRecords`, `selectedOperationHistoryRecord`, `operationHistoryError`, `isOperationHistoryVisible`.
- Premiere: `premiereStatus`, `premiereStatusError`, `premiereLaunchMessage`, `isPremiereStatusLoading`, `isPremiereImportSubmitting`, `premiereImportResult`, `premiereImportError`.

Derived state currently includes `visibleVideoRows`, `resultsViewCounts`, `filteredVideoRows`, `auditedRootDirectory`, `removedVideoCount`, all `is...Active` flags, progress percentages, output directories, discovered/metadata items, and capability flags such as `canRunAudit`, `canRefreshAudit`, `canAutoFixSelected`, `canGenerateThumbnails`, `canStartMigration`, and `canEditSelectedInPremiere`.

## Event Handlers by Workflow

- App/bootstrap and commands: `handleAppCommand`, `cancelActiveWork`.
- Settings/diagnostics: `persistSettings`, `updateSettingsField`, `resetSettings`, `runToolDiagnostics`.
- Sources: `handleSelectionResult`, `chooseFolders`, `applyFolderTreeSelection`, `chooseRecentFolder`, `chooseFiles`, `clearSelectedSources`, `chooseOutputFolder`, `updateAuditOption`.
- Path reveal: `revealPath`, `revealKnownFile`, `revealKnownFolder`.
- Audit: `startAuditRequest`, `runAudit`, `refreshAudit`, `cancelAudit`.
- Result rows/storage: `applyAuditResult`, `persistCurrentResult`, `hideVideoPathsFromTable`, `removeSelectedVideos`, `restoreRemovedVideos`, `setShowThumbnails`.
- Operation history: `loadOperationHistory`, `openOperationHistory`, `closeOperationHistory`, `refreshOperationHistory`, `selectOperationHistoryRecord`.
- File operations: `openTrashDialog`, `closeTrashDialog`, `executeTrashPlan`, `closeTrashResultDialog`, `openMoveDialog`, `closeMoveDialog`, `executeMovePlan`, `closeMoveResultDialog`, `openArchiveDialog`, `closeArchiveDialog`, `executeArchivePlan`, `closeArchiveResultDialog`.
- Post-conversion/replacement: `createPostConversionPlan`, `updatePostConversionPlanActions`, `changePostConversionPlanAction`, `applyPostConversionPlanBulkAction`, `replacePostConversionOriginals`, `reviewPostConversionPlan`, `leavePostConversionOutputs`, `backToPostConversionChoices`, `closePostConversionDialog`, `cancelReplacementExecution`, `closeReplacementResultDialog`.
- Media preview: `applyMediaPreviewResult`, `applyPreviewClipResult`, `openThumbnailDialog`, `closeThumbnailDialog`, `startThumbnailGeneration`, `cancelThumbnailGeneration`, `clearPreviewFrameError`, `getFreshThumbnailsForVideo`, `startPreviewClipGeneration`, `cancelPreviewClipGeneration`.
- Utility workflows: `startDiscovery`, `cancelDiscovery`, `startFfprobe`, `cancelFfprobe`.
- Auto-Fix/Auto-Crop: `openAutoFixDialog`, `closeAutoFixDialog`, `startAutoFix`, `cancelAutoFix`, `openAutoCropDialog`, `closeAutoCropDialog`, `startAutoCrop`, `cancelAutoCrop`.
- Migration: `setMigrationNewEditedDir`, `openMigrationDialog`, `closeMigrationDialog`, `selectMigrationFolder`, `startMigrationScan`, `executeMigration`, `closeMigrationResultDialog`.
- Premiere: `refreshPremiereStatus`, `openPremiereBridgeApps`, `editSelectedInPremiere`.
- Full reset: `clearAuditData`.

## Effects and Subscriptions

- App info load: one mount effect calls `window.videoAudit.app.getInfo`.
- Initial state load: one mount effect loads settings and stored audit data in parallel, restores sources/audit options/result rows, and clears storage loading.
- Initial Premiere status: one effect calls `refreshPremiereStatus`.
- Job progress subscriptions: audit, discovery, ffprobe, auto-fix, auto-crop, replacement execution, media preview, preview clips, and migration each install one preload progress listener and return its cleanup function.
- App menu subscription: one effect subscribes to `window.videoAudit.app.onCommand`.
- Escape key listener: one effect adds a `keydown` listener on `window` and removes it on cleanup.

`FolderTreeSelectorDialog` is a component-level exception: it owns folder-tree scan UI state and directly calls `window.videoAudit.folderTree.*` for root selection, scan start/cancel, result loading, and progress subscription.

## Direct Preload/API Calls

The controller still directly uses these preload namespaces:

- `window.videoAudit.app`: `getInfo`, `onCommand`.
- `window.videoAudit.settings`: `get`, `update`, `reset`.
- `window.videoAudit.diagnostics`: `checkTools`.
- `window.videoAudit.dialog`: `chooseFolders`, `chooseVideoFiles`, `chooseOutputFolder`, `chooseMoveDestinationFolder`.
- `window.videoAudit.fileOperations`: `validateKnownPaths`, `revealFile`, `revealFolder`, `createTrashPlan`, `executeTrashPlan`, `createMovePlan`, `executeMovePlan`, `createArchivePlan`, `executeArchivePlan`.
- `window.videoAudit.audit`: `start`, `cancel`, `onProgress`.
- `window.videoAudit.discovery`: `start`, `cancel`, `onProgress`.
- `window.videoAudit.ffprobe`: `start`, `cancel`, `onProgress`.
- `window.videoAudit.autoFix`: `start`, `cancel`, `onProgress`.
- `window.videoAudit.autoCrop`: `start`, `cancel`, `onProgress`.
- `window.videoAudit.mediaPreview`: `start`, `cancel`, `generateFrames`, `startClipGeneration`, `cancelClipGeneration`, `clearCache`, `onProgress`, `onClipProgress`.
- `window.videoAudit.migration`: `scan`, `execute`, `onProgress`.
- `window.videoAudit.operationHistory`: `listRecent`, `getDetails`.
- `window.videoAudit.replacement`: `createPlan`, `updatePlanActions`, `executePlan`, `cancelExecution`, `onProgress`.
- `window.videoAudit.premiere`: `getStatus`, `openBridgeApps`, `createImportRequest`.

The controller also directly calls renderer IndexedDB helpers from `src/renderer/storage/auditResultStorage.ts`: `loadStoredAuditResult`, `saveStoredAuditResult`, `saveStoredAuditHistoryEntry`, and `clearStoredAuditResult`.

## Pure Helper Functions Currently Inside the Controller

No large pure helper groups remain inside `useVideoAuditAppController.ts` after Stage 1. The only controller-local constant that remains outside the hook is `REPLACE_CONFIRMATION_PHRASE`, because it is currently used only by the post-conversion replacement workflow.

Pure helpers now live in focused renderer helper modules:

- `helpers/errors.ts`: `getErrorMessage`.
- `helpers/progress.ts`: `getProgressPercent`.
- `helpers/recentPaths.ts`: `mergeRecentPaths`.
- `helpers/formatting.ts`: `formatDateTime`.
- `helpers/auditOptions.ts`: `DEFAULT_AUDIT_OPTIONS`, `settingsToAuditOptions`.
- `helpers/folderTreeSource.ts`: `getPersistedFolderTreeSourcePaths`, `createPersistedFolderTreeSource`.
- `helpers/resultFilters.ts`: `getAuditedRootDirectory`, `getResultsViewCounts`, `matchesResultsViewFilter`, `isFlaggedRow`, `hasCropIssue`, `hasRowError`.
- `helpers/mediaPreviewRows.ts`: `mergeMediaPreviewItems`, `mergePreviewClipItems`, `mergePreviewFrames`, `getPreviewFrameKey`.
- `helpers/fileOperationItems.ts`: `toKnownFileOperationItem`.
- `helpers/knownDirectories.ts`: `getKnownDirectories`.
- `helpers/premiereRows.ts`: `toPremiereRequestVideo`.
- `helpers/replacementPlan.ts`: replacement-plan action, executable-item, confirmation-threshold, external-volume, and successful-output helpers.

## Cross-Workflow Dependencies

- `applyAuditResult` normalizes row visibility, writes result/summary/error row state, clears selected rows, stores `lastAuditRequest`, and optionally persists to IndexedDB.
- `persistCurrentResult` depends on `lastAuditRequest` and `showThumbnailsState`; any workflow that mutates row metadata or visibility relies on it to keep IndexedDB current.
- `hideVideoPathsFromTable` is shared by remove-selected, Auto-Fix, trash, move, archive, replacement execution, and Premiere import. It updates `auditResult`, `videoRows`, `selectedVideos`, and storage.
- Remove/restore behavior is soft visibility mutation, not deletion. Hidden rows remain in `auditResult.videos` and persisted storage.
- Media-preview row merging updates both `auditResult.videos` and `selectedVideos`, then persists through `persistCurrentResult`.
- Preview-clip row merging follows the same pattern and preserves existing preview frames where possible.
- Auto-Fix and Auto-Crop completion both call `createPostConversionPlan`; Auto-Fix also hides successful source rows before the post-conversion flow.
- Replacement execution hides replaced original rows and opens a replacement result dialog.
- Trash/move/archive operations hide successful source rows and may open operation history after the result dialog closes, depending on settings.
- Premiere import hides selected rows after a queued import request and refreshes Premiere status.
- Operation history is independent state, but file/replacement result close handlers can trigger it.
- `activeAction` controls unrelated busy states for settings saves, source selection, reveal, utilities, file operations, replacement, Premiere, and cache clearing.
- Escape-key behavior spans many workflows through `cancelActiveWork` and depends on a priority order across active jobs and open dialogs.
- `clearAuditData` resets sources, settings-derived fields, results, filters, selection, progress/result/error buckets, dialogs, post-conversion state, replacement state, Premiere import state, storage state, and the pending audit ref.

## Recommended Extraction Order

The Stage 1 helper extraction is already complete. The next extraction order should remain close to `docs/refactor-plan.md`:

1. Stage 2: introduce thin renderer API clients for direct `window.videoAudit.*` calls. Include the `FolderTreeSelectorDialog` direct folder-tree calls in the map for awareness, but preserve component behavior.
2. Stage 3: extract audit result state and persistence before extracting workflows that mutate rows.
3. Stage 4: extract top-level result filtering while leaving PrimeReact column filters inside `VideoResultsTable`.
4. Stage 5: extract row selection and centralized busy/capability helpers to reduce repeated blocking checks.
5. Stage 6: extract app bootstrap, settings, and diagnostics.
6. Stage 7 through Stage 16: extract source selection, path reveal, audit/discovery/ffprobe, operation history, file operations, post-conversion replacement, Auto-Fix/Auto-Crop, media preview, migration, and Premiere bridge in the staged order.
7. Stage 17 and Stage 18: extract app command/Escape orchestration and full clear-data orchestration only after individual workflow reset/cancel callbacks exist.
8. Stage 19: slim `useVideoAuditAppController` into a composition adapter while preserving the flat return shape.
9. Stage 20 remains optional and should wait until workflow ownership is stable.

## Risks and Regression-Prone Areas

- Startup restoration couples settings, folder-tree source persistence, stored audit result, audit options, selected folders/files, thumbnail visibility, and row persistence. It should be split carefully.
- `lastAuditRequest` drives refresh and persistence; losing or updating it at the wrong time can break refresh or cause row mutations not to persist.
- Row hiding must stay soft and persistent. File operations, replacement, Premiere import, and table removal all rely on the same behavior.
- `selectedVideos` contains row objects, not just paths. Row metadata merges and hidden-row updates must keep selection consistent.
- `activeAction` is overloaded. Centralizing busy state should preserve every existing disabled/loading state before simplifying it.
- Progress subscriptions must stay single-listener and cleanup-safe; extracted hooks should avoid duplicate subscriptions or stale result handlers.
- Post-conversion replacement is tightly coupled to Auto-Fix/Auto-Crop result shapes and settings-driven automatic dialog behavior.
- Operation history preview after file/replacement operations is triggered by result-dialog close handlers, not execution completion alone.
- `clearAuditData` is broad and easy to partially reset incorrectly. It should be extracted only after smaller workflows expose explicit reset callbacks.
- Folder-tree scan state currently lives in `FolderTreeSelectorDialog`, not the controller. Moving API clients should not accidentally move folder-tree UI state into the app controller.
- Global search is passed to PrimeReact DataTable, while view filtering is done before rows reach the table. Stage 4 should not duplicate table global filtering.
- Settings reset intentionally resets source and audit-option state in addition to settings. Stage 6 should preserve that composition-layer behavior.
- Main/preload boundaries are currently intact. Future extraction should keep filesystem, ffmpeg/ffprobe, dialogs, and OS integrations behind `window.videoAudit`.

No blocking clarifying questions were found for the current staged plan.
