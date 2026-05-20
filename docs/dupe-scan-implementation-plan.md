# Duplicate Video Scan Implementation Plan

## Current Context

This plan was created against the current `collie-video` codebase on 2026-05-20.

Collie Video is a standalone macOS Electron app. Runtime filesystem access, ffmpeg/ffprobe work, job orchestration, native dialogs, file operations, settings, operation history, and OS integrations stay behind the Electron main/preload boundary. The renderer uses React, PrimeReact, typed renderer API clients, focused workflow hooks, and the video results Zustand store for the result/table workspace.

The current app already includes the important foundations this feature should build on:

- `src/renderer/App.tsx`
  Composes the app shell, source/status bars, results workspace, selection action bar, and workflow dialogs.
- `src/renderer/components/VideoResultsTable.tsx`
  Renders the main PrimeReact `DataTable` with row selection, table filters, row actions, availability tags, and details dialog access.
- `src/renderer/components/SelectionActionBar.tsx`
  Owns selected-row actions such as Auto-Fix, Crop Options, Premiere, Move to Trash, Move to Folder, Archive Originals, Migrate New Edits, and Remove from Table.
- `src/renderer/hooks/useVideoAuditAppController.ts`
  Composes focused workflow hooks and exposes the compatibility controller consumed by `App.tsx`.
- `src/renderer/stores/useVideoResultsStore.ts` and `src/renderer/stores/videoResultsSelectors.ts`
  Own canonical result rows, active rows, selected row IDs, search/filter state, row visibility, row metadata merges, and derived selected rows.
- `src/main/services/fileDiscoveryService.ts`
  Recursively discovers supported video files, skips symlinks/system directories, respects cancellation, and returns path, filename, directory, size, modified date, extension, and file type.
- `src/main/services/ffprobeService.ts`
  Reads video metadata through ffprobe with cancellation support.
- `src/main/services/fileOperationService.ts`
  Creates and executes safe Move to Trash plans using macOS Trash, immediate pre-execution revalidation, typed confirmation for risky plans, itemized results, and operation history records.
- `src/main/utils/fileOperationSafety.ts`
  Validates known paths in the main process without exposing arbitrary filesystem access to the renderer.
- `src/shared/constants/ipcChannels.ts`, `src/preload/videoAuditApi.ts`, and `src/renderer/api/*Client.ts`
  Define the typed cross-process boundary.
- `src/main/services/migrationService.ts`
  Already contains a separate exact-filename matching workflow, but it is copy/archive oriented and should remain separate from duplicate candidate review.

The existing app does not use routes. It uses one results-first workspace with dialogs and side panels. A Duplicate Review section should therefore be added as a dedicated workspace mode/section inside the app shell rather than as a browser route.

## Goal

Add a review-first Duplicate Video Scan workflow.

The user selects one or more existing project/result rows, chooses a folder to scan recursively, sees possible duplicates based on exact filename matches, compares source and candidate metadata, marks only scanned candidates for Trash, reviews a final confirmation, and moves marked candidates to macOS Trash after immediate revalidation.

This is not an automatic duplicate remover. In v1, "duplicate" means "duplicate candidate found by exact filename match." Metadata helps the user decide; it is not part of the match rule.

## Non-Goals

- Do not implement fuzzy filename matching.
- Do not match `foo copy.mp4`, `foo (1).mp4`, `foo_EDIT.mp4`, or similar-name variants.
- Do not match by duration.
- Do not match by file size.
- Do not match by resolution, bitrate, codec, aspect ratio, created date, or modified date.
- Do not match `foo.mp4` to `foo.mov` in v1.
- Do not use PickList as the primary review UI.
- Do not use TreeTable unless implementation uncovers a strong reason.
- Do not preselect files for Trash.
- Do not allow selected source/project files to be marked for Trash in v1.
- Do not permanently delete files.
- Do not mutate the filesystem before explicit user confirmation.
- Do not add Express, HTTP endpoints, or SSE.
- Do not expose Node APIs to the renderer.
- Do not persist marked-for-trash state into projects or audit-result cache in v1.
- Do not redesign unrelated app areas.
- Do not write tests unless explicitly requested.

## Matching Semantics

### Match Rule

v1 should implement only:

```ts
export type DuplicateMatchType = 'exact_filename';
```

A scanned candidate matches a selected source when both files have the same basename including extension after applying the v1 case-normalization rule.

Examples:

```txt
/Project/Raw/foo.mp4
/Exports/Edited/foo.mp4
match
```

```txt
/Project/Raw/foo.mp4
/Exports/Edited/foo.mov
no match
```

```txt
/Project/Raw/foo.mp4
/Exports/Edited/foo copy.mp4
no match
```

### Case Sensitivity

The app is a private macOS utility and Finder normally treats filenames case-insensitively on the default macOS filesystem. The duplicate scan should therefore use case-insensitive exact basename matching on macOS while preserving actual filename casing for display.

Implementation detail:

```ts
function getDuplicateFilenameKey(fileName: string): string {
  return process.platform === 'darwin' ? fileName.toLowerCase() : fileName;
}
```

This is a conscious product choice. The current migration scan uses raw `fileName` keys, so the duplicate scan implementation should document the difference locally and avoid changing migration behavior.

### Candidate Exclusions

- If the scanned path is the same absolute path as a selected source path, exclude it from duplicate candidates.
- If multiple selected source rows share the same filename key, the same scanned candidate may match more than one source group. Renderer mark state and final Trash execution must dedupe by candidate path/id so one file cannot be moved to Trash twice.
- Scanned candidates should be files with supported video extensions only, using `src/shared/constants/videoExtensions.ts`.
- Symlinks should remain skipped, consistent with existing discovery and file-operation safety behavior.

## Data Model

Add shared duplicate scan types in:

```txt
src/shared/types/duplicateScan.ts
```

Use the app's existing video metadata conventions (`durationSeconds`, `sizeBytes`, `modifiedAt`, `modifiedAtMs`) rather than introducing a parallel `durationMs` model.

Suggested types:

```ts
export type DuplicateMatchType = 'exact_filename';

export type DuplicateTrashStatus =
  | 'unmarked'
  | 'planned'
  | 'moved_to_trash'
  | 'skipped'
  | 'failed';

export interface DuplicateScanSourceInput {
  id: string;
  path: string;
  fileName: string;
  directory: string;
  durationSeconds?: number | null;
  durationFormatted?: string;
  sizeBytes?: number | null;
  width?: number | null;
  height?: number | null;
  resolution?: string;
  bitRate?: number | null;
  bitRateMbps?: number | null;
  modifiedAt?: string | null;
  modifiedAtMs?: number | null;
  fileSystemSizeBytes?: number | null;
  fileType?: string;
  extension?: string;
  fileExtension?: string;
}

export interface DuplicateScanRequest {
  scanFolder: string;
  sources: DuplicateScanSourceInput[];
}

export interface DuplicateScanSource extends DuplicateScanSourceInput {
  matchKey: string;
}

export interface DuplicateScanCandidate {
  id: string;
  sourceId: string;
  path: string;
  fileName: string;
  directory: string;
  durationSeconds: number | null;
  durationFormatted: string;
  durationDeltaSeconds: number | null;
  sizeBytes: number | null;
  sizeDeltaBytes: number | null;
  width: number | null;
  height: number | null;
  resolution: string;
  bitRate: number | null;
  bitRateMbps: number | null;
  modifiedAt: string | null;
  modifiedAtMs: number | null;
  fileType: string;
  extension: string;
  matchType: DuplicateMatchType;
  trashStatus: DuplicateTrashStatus;
  trashError?: string | null;
}

export interface DuplicateScanGroup {
  id: string;
  source: DuplicateScanSource;
  candidates: DuplicateScanCandidate[];
}

export interface DuplicateScanResult {
  scanId: string;
  status: 'complete';
  scannedFolder: string;
  startedAt: string;
  completedAt: string;
  sourceCount: number;
  scannedFileCount: number;
  checkedVideoFileCount: number;
  matchCount: number;
  groups: DuplicateScanGroup[];
  warnings: string[];
}
```

Progress and response types should follow existing job conventions:

```ts
export type DuplicateScanPhase =
  | 'validating'
  | 'walking'
  | 'matching'
  | 'metadata'
  | 'complete'
  | 'error'
  | 'canceled';

export interface DuplicateScanProgress {
  jobId: string | null;
  scanId: string | null;
  status: JobStatus;
  phase: DuplicateScanPhase;
  scannedFileCount: number;
  checkedVideoFileCount: number;
  filenameMatchesFound: number;
  metadataProcessedCount: number;
  metadataTotalCount: number | null;
  currentFile: string | null;
  message: string | null;
  error?: string | null;
}
```

Stable identity rules:

- Source id should be `row.id ?? row.path`.
- Candidate id should be the candidate absolute path for v1, or a deterministic hash of that path if a path-safe id is needed for React keys.
- Marked state should be keyed by candidate id/path, never by `DataTable` index.
- Trash execution should dedupe candidates by path before creating a plan.

## Main Process Architecture

Add:

```txt
src/main/services/duplicateScanService.ts
src/main/ipc/duplicateScanIpc.ts
```

Update:

```txt
src/main/ipc/registerIpcHandlers.ts
src/shared/constants/ipcChannels.ts
src/preload/videoAuditApi.ts
```

### Service Responsibilities

`duplicateScanService` should:

- validate the scan folder as an absolute directory
- validate that at least one source exists in the request
- normalize source inputs into `DuplicateScanSource`
- recursively scan the selected folder with `discoverVideoFiles({ includeSubfolders: true })`
- build a source filename-key map
- compare scanned videos by exact filename key only
- exclude scanned files whose absolute path equals a selected source path
- collect stat metadata from discovery and ffprobe metadata for matched candidates
- compute display-only duration and size deltas
- produce grouped results sorted by source filename/path and candidate path
- preserve actual filename casing in result display fields
- report warnings for unreadable folders/files from discovery when available
- support cancellation through `AbortSignal`

Metadata collection should happen after filename matching, not for every scanned video. This keeps large folder scans cheaper when only a small subset has matching names.

### IPC Shape

Add channels similar to existing long-running jobs:

```ts
duplicateScanStart: 'duplicate-scan:start',
duplicateScanCancel: 'duplicate-scan:cancel',
duplicateScanGetResult: 'duplicate-scan:get-result',
duplicateScanProgress: 'duplicate-scan:progress',
duplicateScanCreateTrashPlan: 'duplicate-scan:trash:create-plan'
```

`duplicateScanCreateTrashPlan` should receive a `scanId` and candidate ids/paths from the current scan result, validate that those candidates belong to the stored scan result, reject source ids/paths, dedupe by candidate path, and delegate to the existing `createTrashPlan` service with known directories including the scanned folder.

Execution can use the existing file-operation `executeTrashPlan` endpoint because the returned `TrashOperationPlan` already has a plan id and the service revalidates immediately before `shell.trashItem`.

### Job Registry

Use `JobRegistry<DuplicateScanRequest, DuplicateScanJobSnapshot, DuplicateScanResult>`.

The job should emit progress for:

- validation start
- directory walking
- matching
- candidate metadata extraction
- complete/error/canceled

The result should be retrievable through `duplicateScanGetResult`, matching the audit/media/migration pattern.

### Settings

Use `getSettings()` to respect `ffprobePathOverride` when reading candidate metadata.

No ffmpeg work is needed for v1.

## Preload And Renderer API Boundary

Add a typed preload namespace:

```ts
window.videoAudit.duplicateScan.start(request)
window.videoAudit.duplicateScan.cancel(jobId)
window.videoAudit.duplicateScan.getResult(jobId)
window.videoAudit.duplicateScan.createTrashPlan(request)
window.videoAudit.duplicateScan.onProgress(callback)
```

Add:

```txt
src/renderer/api/duplicateScanClient.ts
```

The renderer client should stay thin and should not own workflow decisions, matching the existing `auditClient`, `mediaPreviewClient`, `migrationClient`, and `fileOperationsClient` pattern.

Add a dedicated dialog picker if the current copy/title matters:

```ts
window.videoAudit.dialog.chooseDuplicateScanFolder()
```

The current `dialog.chooseFolders()` works technically, but its title says "Choose folders to audit" and allows multi-selection. A dedicated single-folder dialog with title "Choose folder for Duplicate Scan" will make the feature clearer without exposing broader filesystem access.

## Renderer Architecture

Add a focused workflow hook:

```txt
src/renderer/hooks/useDuplicateScanWorkflow.ts
```

Responsibilities:

- open/close the setup scan dialog
- select the scan folder through `dialogClient`
- build source inputs from `selectedVideos`
- start/cancel scan jobs through `duplicateScanClient`
- subscribe to duplicate scan progress
- load the final result
- own duplicate result, scan errors, no-result state, active job id, and scan folder state
- own marked candidate ids or delegate that to a small focused store if component complexity requires it
- create duplicate trash plans from marked candidates
- execute confirmed trash plans through the existing file-operation client
- update candidate `trashStatus` and `trashError` from the execution result
- clear marks and duplicate result state when appropriate

Do not make this a generic app store. A hook is the right first implementation because the state is a single workflow result and its review UI. If mark state needs access from many distant components later, add a focused `useDuplicateScanStore`, not `useAppStore`.

Update controller and active action types:

```txt
src/renderer/types/videoAuditAppController.ts
src/renderer/hooks/useVideoAuditAppController.ts
src/renderer/hooks/useWorkflowBusyState.ts
src/renderer/app/useAppCommands.ts
```

Suggested active actions:

```ts
'duplicateScan'
'duplicateTrashPlan'
'duplicateTrashExecute'
```

The app-level Escape/cancel priority should cancel an active duplicate scan before closing dialogs, consistent with audit/media/migration behavior.

## UI/UX Flow

### Entry Point

Add a `Dupe Scan` action when selected rows exist.

Recommended placement:

- add a primary or secondary `Dupe Scan` button in `SelectionActionBar` beside the other selected-row actions, or
- add it as a visible selected-row action before the overflow menu if spacing permits.

Copy:

```txt
Dupe Scan
```

Disabled state:

- no selected rows
- blocking workflow active
- project/result table has no active rows

### Scan Setup Dialog

Add:

```txt
src/renderer/components/DuplicateScanDialog.tsx
```

The setup dialog should show:

- selected source count
- match criteria: "Find possible duplicates by exact filename, including extension."
- a folder picker for the recursive scan folder
- scan folder path
- start scan button
- cancel scan button while active
- progress counts:
  - scanned files
  - checked video files
  - filename matches found
  - metadata processed
- no-results state:
  - "No duplicate candidates found"
  - scanned folder
  - checked video files count

The dialog should not imply byte-identical duplicates. Use "duplicate candidates," "possible duplicates," and "filename matches."

When results are found, close the dialog and switch the app to the Duplicate Review workspace.

### Dedicated Duplicate Review Workspace

Add:

```txt
src/renderer/components/DuplicateReviewWorkspace.tsx
```

The app currently has no routes. Add a small workspace mode in `App.tsx`, likely:

```ts
type WorkspaceMode = 'results' | 'duplicate-review';
```

Keep the existing source summary, status strip, audit progress, and selection action bar behavior intact. Only swap the main workspace content between:

- Project Results: existing `ResultsToolbar` + `VideoResultsTable`
- Duplicate Review: new `DuplicateReviewWorkspace`

Use a compact workspace switcher only when duplicate results exist. Do not cram duplicate candidates into `VideoResultsTable`.

### Top-Level Groups Table

Use PrimeReact `DataTable` with row expansion.

Top-level rows are duplicate match groups:

- source filename
- source folder/path
- match count
- marked-for-trash count
- optional source duration
- optional source size
- optional source resolution
- optional source modified date
- expansion control

Use `dataKey="id"` and stable group ids.

### Expanded Row Content

Expanded content should render:

1. Protected source summary

   Copy and labels:

   ```txt
   Project Source
   Source -- not markable for deletion
   ```

   Fields:

   - filename
   - full path
   - duration
   - size
   - resolution
   - bitrate
   - modified date

2. Candidate nested `DataTable`

   Columns:

   - mark-for-trash checkbox
   - filename
   - folder/path
   - duration
   - duration delta compared to source
   - size
   - size delta compared to source
   - resolution
   - bitrate
   - modified date
   - match type/confidence, `Exact filename match`
   - trash status after execution

Only candidate rows have checkboxes. Source rows do not.

### Sticky Review Footer

At the bottom of the Duplicate Review workspace, show:

- number of files marked
- total size marked
- `Clear Marks`
- `Review & Move to Trash`

Button copy:

```txt
Review & Move to Trash
Move Marked Files to Trash
Clear Marks
Marked for Trash
```

Do not use vague destructive labels such as "Delete Selected."

### Final Confirmation

Add a duplicate-specific confirmation dialog:

```txt
src/renderer/components/DuplicateTrashConfirmDialog.tsx
```

The existing `FileOperationConfirmDialog` is useful for generic plans, but the duplicate workflow needs source/candidate grouping in the final review. The duplicate dialog can still consume the `TrashOperationPlan` returned by the main process.

The confirmation dialog should show:

- total marked count
- total marked size
- scanned folder
- grouped source sections
- protected source file(s) that will be kept
- candidate file(s) that will be moved to macOS Trash
- blocked/warning items from the trash plan
- typed confirmation if `TrashOperationPlan.confirmation.isRequired`

Submit copy:

```txt
Move Marked Files to Trash
```

### Result State

After execution:

- update candidate status for each result item
- show moved/skipped/failed counts
- keep the Duplicate Review workspace visible
- clear marks for moved/skipped/failed items
- optionally offer operation history if the user's settings request operation-history preview
- allow the user to rescan from the setup dialog

Use "moved to Trash," "skipped," and "failed." Avoid "deleted."

## Safety Strategy

1. Source rows are protected.

   Source summaries are display-only. They do not render mark-for-trash controls and never enter the duplicate trash plan.

2. Candidates are unmarked by default.

   The user must explicitly mark candidate rows.

3. Trash planning is candidate-id based.

   The duplicate trash plan endpoint should resolve marked candidate ids from the stored duplicate scan result and reject unknown ids or source ids.

4. Trash execution uses existing macOS Trash safety.

   Reuse the existing `createTrashPlan` and `executeTrashPlan` behavior so files are moved to macOS Trash through Electron `shell.trashItem`, not permanently deleted.

5. Immediate revalidation happens before Trash.

   Existing trash execution validates expected filename, expected size, expected modified timestamp, file kind, and supported extension immediately before moving each item. Changed or missing files fail/skip instead of being moved.

6. Partial failure is normal.

   Result UI must clearly show moved, skipped, and failed items and preserve enough error text for the user to decide whether to rescan.

7. Same-path source candidates are excluded.

   A scanned file at the exact source path should never become a markable candidate.

8. Renderer stays UI-only.

   Renderer components and hooks should call typed clients only. They must not import `fs`, `path`, `child_process`, or Electron main APIs.

9. No HTTP or SSE.

   Use Electron IPC and preload subscriptions, matching the rest of the app.

## Persistence And Project Considerations

v1 duplicate scan results should be transient renderer workflow state.

Do not store duplicate scan results or marked candidates in:

- `auditResultStorage.ts`
- named project JSON
- app settings
- localStorage

Reasons:

- marked-for-trash state is destructive intent and should not survive relaunch by accident
- scan results become stale quickly
- operation history already records executed Trash operations

Reset duplicate workflow state when:

- clear cache/data runs
- a new project is restored
- a saved project is scanned again
- a new duplicate scan starts
- source rows are replaced by a fresh audit

If future product requirements need persistent duplicate review sessions, add a versioned project/workspace schema deliberately and never persist marked-for-trash state as active intent without a fresh confirmation.

## Staged Implementation Plan

## Stage 1 - Shared Types And Scan Semantics

### Goal

Add the shared duplicate scan contract and document the exact v1 semantics in code.

### Requirements

- Add `src/shared/types/duplicateScan.ts`.
- Add `DuplicateMatchType = 'exact_filename'`.
- Define source, candidate, group, result, progress, start/cancel/get-result, and duplicate trash plan request/response types.
- Use `durationSeconds`/`sizeBytes` naming consistent with existing `VideoRow`.
- Define case-insensitive macOS filename key behavior.
- Define exact basename including extension behavior.
- Define same-path source exclusion.
- Do not add UI or main-process execution in this stage.

### Acceptance Criteria

- Types compile.
- Exact filename semantics are visible and unambiguous.
- Future match types are mentioned only as deferred options.
- No renderer filesystem access is introduced.

## Stage 2 - Main Duplicate Scan Service

### Goal

Implement duplicate candidate discovery in the Electron main process.

### Requirements

- Add `src/main/services/duplicateScanService.ts`.
- Reuse `discoverVideoFiles` for recursive scan discovery.
- Reuse `runFfprobe` for matched candidate metadata.
- Use `getSettings()` for ffprobe path override.
- Match only by exact filename key.
- Exclude source same-path matches.
- Compute display-only duration and size deltas.
- Return grouped results with stable ids.
- Respect cancellation.
- Keep scan result in main-process job/result memory for later candidate-id validation.

### Acceptance Criteria

- Scanning a folder with exact filename matches returns duplicate candidate groups.
- Scanning a folder without matches returns a complete result with zero groups.
- Duration, size, resolution, bitrate, and modified date do not affect matching.
- Candidate metadata failures do not crash the whole scan; candidates can show unknown metadata plus warnings/errors.
- Source files are not modified.

## Stage 3 - Duplicate Scan IPC, Preload, And Client

### Goal

Expose duplicate scan through the existing typed Electron boundary.

### Requirements

- Add duplicate scan IPC channels in `src/shared/constants/ipcChannels.ts`.
- Add `src/main/ipc/duplicateScanIpc.ts` and register it in `registerIpcHandlers`.
- Add `window.videoAudit.duplicateScan` methods in `src/preload/videoAuditApi.ts`.
- Add `src/renderer/api/duplicateScanClient.ts`.
- Add a dedicated single-folder duplicate scan dialog API if needed for correct title/copy.
- Follow the existing start/cancel/result/progress subscription pattern.

### Acceptance Criteria

- Renderer can start, cancel, subscribe to progress, and fetch duplicate scan results through typed preload APIs.
- Renderer does not receive raw Node or Electron APIs.
- No Express, HTTP, or SSE paths are added.

## Stage 4 - Renderer Workflow Hook And Controller Integration

### Goal

Add duplicate scan workflow state without changing the main results table behavior.

### Requirements

- Add `src/renderer/hooks/useDuplicateScanWorkflow.ts`.
- Build scan source inputs from `selectedVideos`.
- Own scan dialog visibility, selected scan folder, progress, result, errors, active job id, marked candidate ids, trash plan/result state, and reset behavior.
- Integrate into `useVideoAuditAppController`.
- Add active actions and busy-state booleans.
- Add Escape/app command handling for active duplicate scan cancellation and dialog close priority.
- Clear or reset duplicate state when audit/project/cache workflows replace the active result workspace.

### Acceptance Criteria

- Existing audit, table, selected-row, file-operation, migration, Premiere, Auto-Fix, Auto-Crop, and media-preview workflows are preserved.
- Duplicate scan cannot start without selected rows.
- Duplicate scan can be canceled while running.
- No feature UI is visible unless selected rows or duplicate results make it relevant.

## Stage 5 - Scan Setup Dialog And Entry Action

### Goal

Let the user launch a duplicate scan from selected project videos.

### Requirements

- Add `Dupe Scan` action to `SelectionActionBar`.
- Add `DuplicateScanDialog`.
- Show selected source count and exact filename criteria.
- Let user pick a scan folder.
- Start/cancel scan from the dialog.
- Show progress counts.
- Show "No duplicate candidates found" in-dialog when result groups are empty.
- When results exist, close the dialog and switch to Duplicate Review workspace.

### Acceptance Criteria

- No candidates are pre-marked after scan.
- No-results state includes scan folder and checked video files count.
- Results-found state navigates to the dedicated Duplicate Review workspace.
- Existing selected-row actions still behave the same.

## Stage 6 - Duplicate Review Workspace

### Goal

Render scan results in a dedicated PrimeReact `DataTable` row-expansion review UI.

### Requirements

- Add `DuplicateReviewWorkspace`.
- Add a workspace mode/switcher in `App.tsx` instead of routing.
- Render top-level duplicate groups in a PrimeReact `DataTable` with row expansion.
- Render protected source summary in expanded rows.
- Render nested candidate `DataTable` with mark-for-trash checkboxes and comparison metadata.
- Show `Exact filename match` as the match type.
- Render marked counts by group and globally.
- Use stable ids/data keys.

### Acceptance Criteria

- Duplicate candidates are grouped under their selected source videos.
- Source files are visually protected and not markable.
- Candidate marks survive row expansion/collapse and pagination.
- Marking one candidate does not affect unrelated candidates.
- Candidate mark state is not keyed by row index.

## Stage 7 - Review And Move Marked Candidates To Trash

### Goal

Safely move explicitly marked duplicate candidates to macOS Trash.

### Requirements

- Add duplicate-specific trash plan creation through main IPC using `scanId` and marked candidate ids.
- Delegate plan creation to existing `createTrashPlan` after candidate validation.
- Add `DuplicateTrashConfirmDialog` with source/candidate grouping and typed confirmation support.
- Execute through existing `executeTrashPlan`.
- Map result items back onto duplicate candidates by path/id.
- Show moved/skipped/failed summary.
- Clear moved/skipped/failed marks after execution.
- Hide or disable candidates moved to Trash from future marking in the same review state.

### Acceptance Criteria

- Source files are never included in the trash plan.
- Candidate files are revalidated immediately before Trash.
- Missing or changed candidates are skipped/failed with clear messages.
- Files are moved to macOS Trash, not permanently deleted.
- Partial failures are visible and understandable.
- Operation history still records the underlying Trash operation.

## Stage 8 - Reset, Persistence, And Project Boundaries

### Goal

Keep duplicate scan state transient and aligned with existing project/result lifecycle.

### Requirements

- Clear duplicate scan results on clear cache/data.
- Clear duplicate scan results when restoring or scanning a project.
- Clear duplicate scan results when a fresh audit replaces the current result rows.
- Do not persist duplicate result or marked state in project snapshots.
- Do not persist duplicate result or marked state in `auditResultStorage.ts`.
- Preserve existing named-project dirty-state behavior.

### Acceptance Criteria

- Relaunching the app does not restore stale marked duplicate candidates.
- Saving a project does not save destructive intent.
- Opening another project cannot carry over duplicate scan marks.
- Existing audit-result persistence remains unchanged.

## Stage 9 - Styling, Copy, And Accessibility

### Goal

Make the workflow feel native to the current app without redesigning unrelated surfaces.

### Requirements

- Add narrowly scoped CSS for duplicate scan/review components.
- Reuse PrimeReact `DataTable`, `Column`, `Dialog`, `Button`, `Checkbox`, `Message`, `ProgressBar`, and `Tag`.
- Use copy that says "duplicate candidates," "possible duplicates," "filename matches," "Marked for Trash," and "Move to Trash."
- Ensure long paths truncate with titles/tooltips.
- Ensure row expansion content remains scannable at desktop sizes.
- Avoid nested cards; use panels, bands, grids, and tables consistent with existing app styling.

### Acceptance Criteria

- Text fits in compact table/dialog controls.
- Destructive copy is clear and reversible where possible.
- The Duplicate Review workspace does not visually imply filesystem hierarchy.
- Existing Results workspace layout is preserved.

## Stage 10 - Verification And Documentation

### Required Checks

Run available checks:

```bash
npm run typecheck
npm run build
git diff --check
```

There is no `npm run lint` script currently. Do not add one as part of this feature unless requested.

### Manual Verification Checklist

- run duplicate scan with no selected rows blocked
- run duplicate scan after selecting one row
- run duplicate scan after selecting multiple rows
- choose/cancel scan folder picker
- scan folder with no exact filename matches
- scan folder with one exact filename match
- scan folder with multiple exact filename matches for one source
- scan folder where same candidate filename differs only by case
- verify `foo.mp4` does not match `foo.mov`
- verify `foo copy.mp4` does not match `foo.mp4`
- verify same-path source file is excluded from candidates
- expand/collapse duplicate groups
- mark/unmark candidates
- clear marks
- review final confirmation grouped by source
- trigger typed confirmation for high-count or high-size marked candidates
- move marked candidates to Trash
- verify moved/skipped/failed result state
- verify source files remain in place
- verify changed/missing candidate is skipped/failed after scan but before Trash
- cancel active duplicate scan
- clear cache/data and verify duplicate review state clears
- restore a project and verify stale duplicate review state does not carry over
- run existing Move to Trash from the main selected-row workflow to confirm no regression

## Risks And Tradeoffs

- Case-insensitive duplicate matching differs from current migration scan raw filename matching. This is intentional for the macOS duplicate review workflow and should be documented in the duplicate service.
- Large scans can still be expensive if many filename matches require ffprobe metadata. Matching before ffprobe limits the cost, but progress/cancel behavior remains important.
- A selected source set with duplicate filenames can cause one scanned candidate to appear under multiple source groups. Execution must dedupe by candidate path.
- Existing trash plan revalidation uses size and modified timestamp as safety checks. That is correct for execution safety, but it must not be confused with matching criteria.
- Operation history will record a generic Trash operation unless future work adds duplicate-specific operation metadata.
- v1 does not persist duplicate scan sessions. This avoids stale destructive intent, but users must rescan after relaunch.
- The workspace switcher is a modest layout evolution. It should be kept small so existing results behavior remains primary.

## Future Enhancements Deferred

- Similar filename scan.
- Same stem across video extensions, such as `foo.mp4` matching `foo.mov`.
- Fuzzy normalized filename matching.
- Hash or partial-hash duplicate detection.
- Optional duration/size/resolution filters after candidate discovery.
- Thumbnail/preview comparison inside duplicate review.
- Persisted duplicate review sessions without persisted marks.
- Duplicate scan across multiple scan folders.
- User-configurable case sensitivity.
- CSV/JSON export of duplicate candidates.
- In-app restore-from-Trash guidance.
- Duplicate-specific operation history records.
- A source/candidate "keep this one" decision model.
- PickList mode as an optional future review view.

## Definition Of Done

This feature is complete when:

- duplicate scan uses exact basename including extension as the only v1 match rule
- duration, size, resolution, bitrate, codec, and modified date are display-only comparison metadata
- scans run recursively through Electron main-process services
- progress and cancellation use typed IPC/preload APIs
- renderer code does not access Node APIs
- results render in a dedicated Duplicate Review workspace
- PrimeReact `DataTable` row expansion is the primary review UI
- source project files are protected and never markable for deletion
- candidate files are unmarked by default and markable individually
- final confirmation is grouped and explicit
- marked candidates move to macOS Trash, not permanent deletion
- candidate paths are revalidated immediately before Trash
- moved/skipped/failed outcomes are reported clearly
- duplicate workflow state does not persist stale destructive intent
- existing audit, project, file-management, migration, Premiere, Auto-Fix, Auto-Crop, thumbnail, and replacement workflows continue to work
