# Improved Duplicate Detection Stage 0 Baseline

## Purpose

Stage 0 documents the current exact filename Duplicate Scan workflow before more improved duplicate detection behavior is attached to the app.

This is a preservation baseline, not a runtime change. The current scanner remains useful and should continue to catch files with the same basename plus extension across different folders regardless of duration, size, resolution, bitrate, codec, or modified date.

This document reflects the current repo after the Stage 1 shared type contracts and Stage 2 OpenCV fingerprint prototype were added. Those later-stage additions are additive and are not wired into the existing Duplicate Scan UI or IPC flow.

## Behavior To Preserve

- Duplicate Scan starts from selected rows in the current results table.
- The user chooses a separate folder tree to scan recursively.
- Matching uses exact basename including extension.
- Matching is case-insensitive on macOS through `getDuplicateFilenameKey`.
- Same absolute source paths are excluded from candidate results.
- Duration, size, resolution, bitrate, codec, modified date, and ffprobe metadata are comparison display fields only; they are not matching inputs.
- Selected project source rows are protected and cannot be marked for Trash from Duplicate Review.
- Candidate rows are unmarked by default.
- Candidate review state is transient and does not persist into project JSON or audit-result IndexedDB storage.
- Move to Trash is planned and executed only after explicit review and confirmation through the existing file-operation services.
- Current duplicate scan behavior must keep working even if OpenCV, Python, or visual fingerprint generation is unavailable.

## Current Flow

### Shared Contract

`src/shared/types/duplicateScan.ts` owns the current v1 duplicate scan contract:

- `DuplicateScanRequest` carries `scanFolder` and selected `sources`.
- `DuplicateScanSourceInput` mirrors the row metadata needed to compare and display selected result rows.
- `DuplicateScanSource` adds `matchKey`.
- `DuplicateScanCandidate` stores exact-match candidate display metadata, ffprobe comparison fields, and duplicate-specific Trash state.
- `DuplicateScanGroup` groups candidates under one protected project source.
- `DuplicateScanResult` is the current renderer-facing review result.
- `DuplicateScanProgress` / `DuplicateScanJobSnapshot` are the current job progress shapes.
- `DuplicateScanTrashPlanRequest` and `DuplicateScanTrashPlanResponse` bridge marked candidates to the existing Trash plan flow.

The v1 exact filename constants are still the source of truth:

- `DUPLICATE_SCAN_MATCH_TYPE = 'exact_filename'`
- `DUPLICATE_SCAN_FILENAME_MATCH_SCOPE = 'basename_with_extension'`
- `DUPLICATE_SCAN_FILENAME_CASE_MODE = 'case_insensitive_on_macos'`
- `DUPLICATE_SCAN_EXCLUDES_SAME_PATH_SOURCE_MATCHES = true`

Stage 1 widened the future type vocabulary with improved scan modes, visual fingerprint types, and improved candidate/evidence shapes. That does not change the v1 exact filename result shape or behavior.

### Main Process Service

`src/main/services/duplicateScanService.ts` owns the current exact filename scan behavior.

The service flow is:

1. Validate the request and selected sources.
2. Require an absolute non-symlink scan folder.
3. Normalize selected source rows and compute each source `matchKey`.
4. Recursively discover videos in the scan folder through `discoverVideoFiles`.
5. Build candidate groups by comparing discovered file names to selected source match keys.
6. Exclude candidates whose resolved path is the same as a selected source path.
7. Read ffprobe metadata only for matched candidates.
8. Store the completed scan result in main-process memory for later candidate-id validation.
9. Resolve marked candidate ids against the stored result before creating any file-operation plan.

The key preservation point is that `buildCandidateGroups` is intentionally filename-only. Visual fingerprints, duration, and metadata should not be inserted into this function as hidden matching criteria.

### IPC And Job Lifecycle

`src/main/ipc/duplicateScanIpc.ts` owns the current IPC job boundary.

Current channels in `src/shared/constants/ipcChannels.ts` are:

- `duplicate-scan:start`
- `duplicate-scan:cancel`
- `duplicate-scan:get-result`
- `duplicate-scan:progress`
- `duplicate-scan:trash:create-plan`

The IPC layer uses `JobRegistry<DuplicateScanRequest, DuplicateScanJobSnapshot, DuplicateScanResult>` and keeps the usual start/cancel/progress/result pattern. It does not expose filesystem, Node, Python, OpenCV, or child-process APIs to the renderer.

Trash planning remains candidate-id based. `createDuplicateScanTrashPlan` validates the request, resolves ids through `getDuplicateScanCandidatesForTrash`, rejects source ids/paths, deduplicates candidate paths, and delegates to `createTrashPlan`.

### Preload And Renderer Client

`src/preload/videoAuditApi.ts` exposes only typed duplicate scan methods under `window.videoAudit.duplicateScan`:

- `start`
- `cancel`
- `getResult`
- `createTrashPlan`
- `onProgress`

`src/renderer/api/duplicateScanClient.ts` is a thin renderer client over that typed preload API. The renderer does not call `fs`, `path`, `child_process`, Python, OpenCV, or Electron main-process services directly.

### Renderer Workflow

`src/renderer/hooks/useDuplicateScanWorkflow.ts` owns the current transient renderer state:

- selected source rows are converted to `DuplicateScanSourceInput`
- scan folder path
- active job id and progress
- current `DuplicateScanResult`
- marked candidate ids
- duplicate-specific Trash plan/result/error state
- dialog visibility
- reset/clear behavior

The hook builds the current request from selected videos only:

```ts
const request: DuplicateScanRequest = {
  scanFolder,
  sources: selectedVideos.map(toDuplicateScanSourceInput)
};
```

Improved visual modes should not silently change this current exact filename request path. Future stages can add a separate improved request or explicit mode options, but the current selected-row exact filename flow should remain understandable and reversible.

### Review UI

`src/renderer/components/DuplicateScanDialog.tsx` describes the current rule as exact filename matching, including extension. The dialog currently has no improved mode controls and should stay that way until the review UI stage.

`src/renderer/components/DuplicateReviewWorkspace.tsx` shows candidate groups in PrimeReact DataTables:

- source rows are labeled as protected project sources
- candidate rows can be marked for Trash
- metadata deltas are displayed for review
- the match column says `Exact filename match`
- the footer requires explicit review before moving candidates to Trash

Future improved review UI should extend this workspace or create an additive adapter without weakening source protection or preselecting destructive actions.

### Safety And Persistence

The safety path is intentionally conservative:

- exact scanner identifies candidates only
- candidate Trash goes through existing plan/confirm/execute services
- expected size and modified time are passed into file-operation validation where available
- Trash uses macOS Trash, not permanent deletion
- operation history records executed file operations through existing services
- duplicate review result/marks remain transient and are excluded from project/audit persistence

## Extension Points For Future Stages

### Shared Types

Future improved duplicate detection should build on the Stage 1 types in `src/shared/types/duplicateScan.ts`:

- `DuplicateScanMode`
- `DuplicateScanProfile`
- `ImprovedDuplicateScanSourceScope`
- `ImprovedDuplicateScanOptions`
- `ImprovedDuplicateScanRequest`
- `VisualFingerprint`
- `DuplicateCandidateGroup`
- `ImprovedDuplicateScanProgress`
- `ImprovedDuplicateScanResult`

These types should remain additive until an implementation stage intentionally migrates UI and IPC behavior.

### OpenCV Fingerprinting

Stage 2 added `src/main/services/duplicateFingerprintService.ts` and upgraded `scripts/opencv/fingerprint_video.py` to emit `dhash-v1` fingerprints.

This is a main-process-only prototype boundary. It is not exposed through preload IPC and is not called by the current exact filename Duplicate Scan.

Future stages should use this service from a main-process orchestrator, not from renderer code.

### Matching Orchestrator

Future visual or contained-clip matching should be added as an improved duplicate scan orchestrator or explicit mode branch.

Recommended boundary:

- keep `runDuplicateScan` as the current v1 exact filename path until an intentional migration is staged
- run exact filename mode as a cheap first pass
- call fingerprint generation only for explicit visual modes
- keep Python/OpenCV failures from blocking exact filename mode
- return reviewable candidate groups with evidence instead of mutating files

### IPC Boundary

Do not add new preload/IPC methods until an implementation stage explicitly needs them.

When they are added, they should follow the current job pattern:

- start
- cancel
- progress
- get result
- candidate action planning after result validation

The renderer should receive candidate summaries and evidence, not raw child-process access or arbitrary filesystem access.

### Review UI

Future review UI should preserve the current review semantics:

- sources protected by default
- candidates unmarked by default
- no automatic destructive action based on confidence
- evidence visible before action
- exact filename groups still visible and distinguishable
- mode filters should be additive, not a replacement for the current exact filename review path

## Preservation Checklist For Future Stages

Before and after each improved duplicate detection stage, confirm:

- `foo.mp4` still does not match `foo.mov` in exact filename mode.
- `foo copy.mp4` still does not match `foo.mp4` in exact filename mode.
- case-insensitive macOS filename matching still works.
- same-path selected source files are excluded from candidate results.
- exact filename mode still works without OpenCV.
- candidate metadata remains display-only in exact filename mode.
- selected source rows remain protected in Duplicate Review.
- candidate rows remain unmarked by default.
- candidate Trash still goes through plan/confirm/execute and immediate revalidation.
- duplicate result and mark state remain transient.
- renderer code still does not import Node filesystem/process APIs.

## Stage 0 Verification

Completed in this pass:

- Reviewed `docs/improved-dupe-detection-plan.md` Stage 0.
- Reviewed `docs/dupe-scan-verification.md`.
- Reviewed current exact filename shared types and constants.
- Reviewed `duplicateScanService.ts` request normalization, exact matching, same-path exclusion, metadata reads, result storage, and candidate validation.
- Reviewed `duplicateScanIpc.ts` job/progress/cancel/result/Trash planning boundary.
- Reviewed `videoAuditApi.ts`, `duplicateScanClient.ts`, `useDuplicateScanWorkflow.ts`, `DuplicateScanDialog.tsx`, and `DuplicateReviewWorkspace.tsx` for renderer/preload ownership.

No production behavior was changed for Stage 0.
