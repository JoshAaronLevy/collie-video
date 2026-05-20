# Project File Availability Implementation Plan

## Project Context

At this point, the app supports named projects stored as JSON under Electron `userData`. A project can restore saved source selection, audit request, audit rows, workspace filters, hidden row state, and settings snapshots. The renderer uses the focused video results Zustand store as the canonical row/table workspace, while the main process owns filesystem access through typed preload APIs.

The app already has a first-pass availability foundation:

* `src/main/utils/fileOperationSafety.ts` validates known paths in the main process.
* `src/shared/types/fileOperations.ts` defines `KnownPathValidationItem` and validation results.
* `src/shared/types/video.ts` defines transient `VideoFileAvailability` row metadata.
* `src/renderer/helpers/projectAvailability.ts` builds validation items and merges validation results into row availability.
* `src/renderer/hooks/useVideoAuditAppController.ts` currently validates files after project restore.
* `src/renderer/components/VideoResultsTable.tsx` already renders Availability tags and availability counts.

This plan turns that foundation into an intentional user-facing missing-file workflow for open projects. When saved project files are no longer present at their original paths, the user should see a clear warning and choose either to dismiss it or remove the missing rows from the active project. Missing videos should not be selectable for processing while they remain missing.

The goal is not to implement relinking yet. Relinking missing files to new locations should remain a future workflow.

**NOTE:** For this plan, you are allowed to open the app in Electron if it helps you visualize the project-open and table-selection flows better than code review. But only if it helps, and do so briefly and sparingly.

**IMPORTANT:** This feature touches project restore, row selection, and result-table behavior. Keep it consistent with the current renderer architecture: main-process filesystem validation, typed preload/client calls, Zustand-owned result rows and selection IDs, focused workflow hooks, and PrimeReact UI patterns already used in the app.

## Primary User Workflows

The app should support:

1. Checking an open project's saved video files against their original saved paths.
2. Warning the user when one or more saved project videos are missing from disk.
3. Letting the user dismiss the warning and continue working with the project.
4. Keeping dismissed missing videos visible but unselected and disabled for processing.
5. Letting the user remove all currently missing videos from the active project.
6. Updating the data table immediately after missing videos are removed.
7. Saving the updated active project after missing videos are removed.
8. Notifying the user after the project has been updated.
9. Re-checking intentionally after project restore, manual user request, and selected workflow preflight.
10. Re-checking occasionally when returning to the app, without background polling.

## Non-Goals

* Do not implement file relinking in this plan.
* Do not search the filesystem for moved files.
* Do not modify, move, delete, trash, or archive any source video files.
* Do not permanently delete rows from project JSON unless a future task explicitly changes row-removal semantics.
* Do not expose renderer filesystem access.
* Do not add arbitrary path APIs to preload.
* Do not add a second generic Zustand store for this workflow unless later implementation proves it is necessary.
* Do not show repeated modal warnings on a short timer.
* Do not block the user from working with available files after they dismiss the warning.
* Do not write tests unless explicitly requested.

## Safety Principles

1. Treat saved file paths and saved metadata as stale until revalidated.
2. Validate file presence only in the Electron main process.
3. Keep the renderer's availability state typed and derived from validation results.
4. Check original saved paths, not guessed or searched paths.
5. Keep missing-file removal non-destructive: update project rows only, never media files.
6. Use existing row removal semantics where possible: `visible: false` and persisted project state.
7. Clear selection for rows as soon as they become missing or unavailable.
8. Disable missing rows at the DataTable selection layer, not only at workflow buttons.
9. Avoid noisy repeated warnings by throttling automatic checks.
10. Always allow a manual check that bypasses the automatic throttle.

## Current Architecture To Build On

```txt
src/
|- main/
|  |- ipc/
|  |  `- fileOperationIpc.ts
|  `- utils/
|     `- fileOperationSafety.ts
|
|- preload/
|  `- videoAuditApi.ts
|
|- renderer/
|  |- api/
|  |  `- fileOperationsClient.ts
|  |- helpers/
|  |  |- projectAvailability.ts
|  |  |- projectSnapshot.ts
|  |  `- resultFilters.ts
|  |- hooks/
|  |  |- useAuditResults.ts
|  |  |- useProjectWorkspace.ts
|  |  |- useSelectionState.ts
|  |  `- useVideoAuditAppController.ts
|  |- stores/
|  |  `- useVideoResultsStore.ts
|  `- components/
|     |- VideoResultsTable.tsx
|     |- SourceSummaryBar.tsx
|     `- DialogChrome.tsx
|
`- shared/
   |- types/
   |  |- fileOperations.ts
   |  |- project.ts
   |  `- video.ts
   `- constants/
      `- ipcChannels.ts
```

Suggested additions:

```txt
src/
`- renderer/
   |- components/
   |  `- ProjectMissingFilesDialog.tsx
   |- helpers/
   |  `- projectAvailability.ts
   `- hooks/
      `- useProjectFileAvailability.ts
```

The exact file names can vary if the implementation finds a better local fit, but the responsibilities should remain separated:

* `fileOperationSafety`: main-process stat/lstat validation only.
* `fileOperationsClient`: thin renderer boundary over the existing preload API.
* `projectAvailability`: pure row/source validation item builders, issue summaries, selectable-row helpers, and display copy.
* `useProjectFileAvailability`: workflow timing, prompt state, manual check, preflight check, dismiss, and remove-missing orchestration.
* `useAuditResults` and `useVideoResultsStore`: canonical row metadata merge, hidden-row updates, persisted current audit result, and selection pruning.
* `ProjectMissingFilesDialog`: user choice UI only.

## Suggested Preload API Shape

Prefer reusing the existing typed validation API:

```ts
window.videoAudit.fileOperations.validateKnownPaths({ items })
```

Do not add APIs like:

```ts
window.videoAudit.files.exists(path)
window.videoAudit.files.stat(path)
window.videoAudit.files.searchForMissingFile(path)
```

If implementation later needs a more project-specific main-process endpoint for chunking or cancellation, keep it high-level and typed:

```ts
window.videoAudit.projects.checkFileAvailability(request)
```

That should be considered only if the existing `validateKnownPaths` API becomes awkward at scale. The first implementation should reuse the existing file-operation validation boundary.

---

## Stage 1 -- Formalize Availability Semantics And Row Eligibility

**Intelligence Level: High**

### Goal

Define exactly what the app means by available, missing, changed, and unavailable files, and define which rows can be selected for processing.

### Requirements

Use the existing `SavedFileAvailability` model:

```ts
export type SavedFileAvailability = 'available' | 'missing' | 'changed' | 'unavailable';
```

Interpret statuses as:

* `available`: the saved path exists, is a file, matches expected file name, matches expected saved size when present, matches expected modified timestamp when present, and has a supported video extension.
* `missing`: the saved path no longer exists.
* `changed`: the saved path exists, but identity metadata no longer matches the saved row.
* `unavailable`: the saved path exists but cannot be treated as the expected usable video file, for example unsupported kind, unsupported extension, symlink-blocked path, or other validation error.

Processing eligibility should be:

```txt
available      -> selectable
unchecked      -> selectable
changed        -> selectable, with warning/status visible
missing        -> not selectable
unavailable    -> not selectable
visible=false  -> not active, not selectable
```

Keep `fileAvailability` transient. Do not persist it into project JSON in this stage. `src/renderer/helpers/projectSnapshot.ts` currently strips `fileAvailability` when saving project rows, and that should remain the default so every open project gets a fresh check instead of trusting an old status.

### Deliverables

* Pure helper functions in `src/renderer/helpers/projectAvailability.ts`, such as:
  * `isMissingProjectVideo(row)`
  * `isUnavailableProjectVideo(row)`
  * `isVideoRowSelectableForProcessing(row)`
  * `getMissingProjectVideoRows(rows)`
  * `summarizeProjectAvailabilityIssues(rows, sourceResults?)`
* Updated comments or local docs inside the helper only where they clarify non-obvious eligibility rules.
* No schema-version bump unless persisted project shape changes.

### Acceptance Criteria

* The eligibility rule is defined in one shared helper, not repeated across components.
* Missing and unavailable rows have one canonical disabled-selection rule.
* Changed rows remain selectable because the file still exists.
* `fileAvailability` remains a fresh validation result, not a saved project field.

---

## Stage 2 -- Extract A Project File Availability Workflow Hook

**Intelligence Level: High**

### Goal

Move the availability workflow out of `useVideoAuditAppController.ts` into a focused hook that owns check timing, check status, prompt state, dismiss behavior, and remove-missing orchestration.

### Requirements

Create a hook shaped roughly like:

```ts
type ProjectAvailabilityCheckReason =
  | 'project-restore'
  | 'manual'
  | 'window-focus'
  | 'selected-workflow-preflight';

interface UseProjectFileAvailabilityValue {
  fileAvailabilityMessage: string | null;
  missingFilesDialogState: ProjectMissingFilesDialogState | null;
  isCheckingProjectFiles: boolean;
  lastProjectFileCheckAt: string | null;
  checkProjectFiles: (reason: ProjectAvailabilityCheckReason, options?: CheckOptions) => Promise<ProjectAvailabilityCheckResult>;
  dismissMissingFilesWarning: () => void;
  removeMissingFilesFromProject: () => Promise<void>;
  clearProjectFileAvailabilityState: () => void;
}
```

The hook should receive explicit dependencies from the controller instead of reaching across modules implicitly:

* active project id and name
* current project object or project source paths when available
* current rows from `useVideoResultsStore.getState()`
* selected folders/files
* `mergeFileAvailabilityIntoRows`
* `hideVideoPathsFromTable`
* project save callback
* workflow message/project message setters as needed
* current blocking-workflow state

The hook should keep the validation id/cancellation race guard currently handled by `availabilityValidationIdRef`, or an equivalent request token, so stale checks cannot overwrite newer results.

For large projects, chunk validation requests before calling `validateKnownPaths` if needed. A reasonable implementation target is chunks of 500 to 1000 items, with all chunk results merged into one summary. This keeps the design safe for 10,000+ row projects without requiring a new main-process API.

### Deliverables

* `src/renderer/hooks/useProjectFileAvailability.ts`
* Controller integration that replaces the current inline `validateProjectFileAvailability` block.
* Updated `ActiveAction` if an explicit checking action is useful, for example `'projectFileCheck'`.
* Reused `fileOperationsClient.validateKnownPaths` API.

### Acceptance Criteria

* Project restore still checks file availability.
* Stale validation responses do not overwrite newer results.
* The controller is smaller and remains a composition adapter.
* Availability checking is unavailable or deferred while a blocking workflow is active.
* Validation failures show a clean message and do not crash or clear existing rows.

---

## Stage 3 -- Missing Files Warning Dialog

**Intelligence Level: Medium**

### Goal

Add a focused warning dialog that appears when an active project check finds missing saved video files.

### Requirements

Create `ProjectMissingFilesDialog.tsx` using existing PrimeReact and `DialogChrome` patterns.

The dialog should show:

* project name
* checked timestamp
* missing video count
* short explanation that source media files were not modified
* a scrollable list or compact table of missing files
* file name and original saved path
* optional note if additional missing files are hidden behind a display cap

Primary actions:

```txt
Dismiss
Remove Missing from Project
```

Action behavior:

* `Dismiss` closes the dialog and leaves rows visible.
* `Remove Missing from Project` hides/removes the missing rows from the active project table state.
* If no active project is available by the time the user clicks remove, show a clean error and do nothing.
* If a new check supersedes the dialog's check id, close or refresh the dialog so stale missing paths are not removed.

Suggested copy:

```txt
Some project videos are missing from their original locations.
You can keep working with available videos, or remove the missing rows from this project. Source files will not be modified.
```

Use `Remove Missing from Project` rather than `Delete`.

### Deliverables

* `src/renderer/components/ProjectMissingFilesDialog.tsx`
* Dialog state exposed by the controller and rendered in `src/renderer/App.tsx`
* Dialog styles in `src/renderer/styles/app.css` if needed

### Acceptance Criteria

* The dialog appears only after a project availability check finds missing row files.
* Dismissing the dialog does not remove rows and does not reselect missing rows.
* The warning does not repeatedly reopen for the same check after dismiss.
* The dialog never implies that media files will be deleted.

---

## Stage 4 -- Disable Missing Row Selection In The DataTable

**Intelligence Level: High**

### Goal

Ensure missing videos are unchecked and cannot be selected for processing after the user dismisses the warning or otherwise continues with missing files visible.

### Requirements

Update selection at two layers:

1. Store-level selection pruning.
2. DataTable-level disabled selection.

Store-level requirements:

* When `mergeFileAvailability` applies a `missing` or `unavailable` status, prune that row id from `selectedRowIds`.
* When `setSelectedRowIds` receives ids for missing/unavailable rows, ignore those ids.
* Keep selection identity as `row.id ?? row.path`.

DataTable requirements:

* Use PrimeReact `DataTable` `isDataSelectable` to return `false` for missing/unavailable rows.
* Keep the checkbox column visible, but disabled for missing/unavailable rows.
* Filter `onSelectionChange` through the same eligibility helper as a defensive guard.
* Add a row class for missing/unavailable rows if needed to make the disabled state legible.
* Continue showing the Availability column and row action disabled reasons.

Workflow capability requirements:

* Selected-row workflows should naturally stop seeing missing rows because `selectedVideos` derives from pruned selected ids.
* Preflight checks in Stage 6 should still validate selected rows before execution in case files disappear after selection.

### Deliverables

* Updated `src/renderer/stores/useVideoResultsStore.ts`
* Updated `src/renderer/hooks/useSelectionState.ts` only if needed
* Updated `src/renderer/components/VideoResultsTable.tsx`
* Shared row-selectability helper in `src/renderer/helpers/projectAvailability.ts`

### Acceptance Criteria

* Missing row checkboxes become unchecked after availability merge.
* Missing row checkboxes are disabled in the table.
* The user cannot select a missing row by clicking the row, the checkbox, or shift/meta selection.
* Changed rows remain selectable.
* Selection counts update immediately after a row becomes missing.

---

## Stage 5 -- Remove Missing Rows From The Active Project

**Intelligence Level: High**

### Goal

Implement the user's "remove them from the project" choice as a durable project/table update without touching media files.

### Requirements

Use the existing row-hiding project semantics unless a future task explicitly changes them:

```txt
missing row -> visible: false
```

Removal workflow:

1. Read the latest missing row paths from the dialog/check state.
2. Revalidate those paths immediately before removal, or at least ensure they are still marked missing in the current row state.
3. Call `hideVideoPathsFromTable(missingPaths)`.
4. Persist the updated current audit result through the existing `useAuditResults` path.
5. Save the active project immediately after the rows are hidden so the project index and project JSON reflect the change.
6. Refresh or apply the project index returned by save.
7. Notify the user with a success or partial message.

Suggested success copy:

```txt
Removed 12 missing video(s) from "Project Name".
```

If zero rows are removed:

```txt
No missing videos needed to be removed.
```

If save fails after rows are hidden:

* Keep the in-memory table update.
* Show a clear save error.
* Leave the project dirty so autosave/manual save can recover.

Important distinction:

* This action should not call trash, move, archive, replacement, or any filesystem mutation API.
* This action should not use operation history because no file operation occurred.
* This action should not remove missing source folders from `project.sources.selectedFolders`; only missing video rows are removed from the result table in this feature.

### Deliverables

* `removeMissingFilesFromProject` in `useProjectFileAvailability`
* Controller/App wiring from `ProjectMissingFilesDialog`
* Immediate project save after successful row hiding
* User-facing success/error messages through existing project/workflow message surfaces

### Acceptance Criteria

* Choosing `Remove Missing from Project` removes missing rows from the active table view.
* Active project row counts update after save.
* The saved project restores without those rows visible.
* Source media files are not modified.
* The user receives a clear notification after the update.

---

## Stage 6 -- Strategic Recheck Triggers

**Intelligence Level: Extra High**

### Goal

Run file-availability checks more often than only project open, while avoiding noisy or expensive background polling.

### Requirements

Implement these triggers:

1. **Project Restore:** Run a full project check after restoring a saved project. This already exists and should move into the new hook.
2. **Manual Check:** Add a user-triggered action such as `Check Files` near project/source/result status. Manual checks bypass the automatic throttle.
3. **Window Focus:** When the app regains focus or document visibility changes back to visible, run a full check only if:
   * an active project is open,
   * there are saved result rows,
   * no blocking workflow is active,
   * the last full check is older than the throttle interval,
   * no missing-files dialog is already waiting for a user decision.
4. **Selected Workflow Preflight:** Before workflows that process selected rows, validate only the selected rows. If any selected row is now missing/unavailable, merge availability, clear those selected rows, show the warning, and do not start that workflow until the user chooses again.

Recommended automatic throttle:

```txt
minimum interval: 10 to 15 minutes
```

Do not use `setInterval` for full-project checks. Prefer event-driven checks:

* project restore
* manual button
* window focus or visibility return
* selected workflow preflight

Selected workflow preflight should apply to:

* Auto-Fix selected videos
* Auto-Crop selected videos
* Generate thumbnails for selected videos
* Generate preview clip for a row
* Premiere import
* Move to Trash
* Move to Folder
* Archive originals

The preflight can be introduced incrementally, but the plan should identify these call sites so missing files cannot sneak into processing after the last full check.

### Deliverables

* Full-check throttle inside `useProjectFileAvailability`
* Manual `Check Files` UI action
* Window focus/visibility effect
* Selected-row preflight helper
* Workflow call-site integration, starting with the highest-risk selected-row processors

### Acceptance Criteria

* Opening a project checks availability.
* Manual `Check Files` checks immediately.
* Returning to the app after the throttle interval checks availability.
* Returning to the app repeatedly within the throttle interval does not repeatedly check or show modal warnings.
* Starting a selected-row processing workflow validates selected files first.
* A newly missing selected file prevents that workflow from starting and becomes unselected.

---

## Stage 7 -- UI Status, Counts, And Notification Polish

**Intelligence Level: Medium**

### Goal

Make the availability state understandable without turning the UI into a warning-heavy experience.

### Requirements

Keep and refine existing surfaces:

* Availability column in `VideoResultsTable`
* Missing/Changed/Unavailable counts in the table header
* `fileAvailabilityMessage` in `VideoResultsTable`
* `fileAvailabilityMessage` in `SourceSummaryBar`
* disabled Reveal action for missing/unavailable rows

Add or refine:

* Manual `Check Files` button with loading state and icon.
* Compact status copy after a clean check.
* Warning copy after missing files are found.
* Success copy after missing rows are removed from the project.
* Row disabled styling that remains readable in dense table layout.

Potential manual button placement:

* Preferred: `ResultsToolbar`, because it is near refresh/clear result actions and applies to result rows.
* Acceptable: `SourceSummaryBar`, because current availability messaging already appears there.
* Avoid burying it inside Settings or Utilities for the first implementation.

Suggested button label:

```txt
Check Files
```

### Deliverables

* Updated component props and controller return shape for `Check Files`
* Loading/disabled state based on `isCheckingProjectFiles` and blocking workflows
* Small CSS additions if row-disabled styling is needed

### Acceptance Criteria

* User can intentionally check project files at any time when no blocking workflow is active.
* Clean checks are informative but not alarming.
* Missing-file warnings are clear and actionable.
* Table status remains useful after the missing-files dialog is dismissed.

---

## Stage 8 -- Persistence, Project Index, And Dirty-State Behavior

**Intelligence Level: High**

### Goal

Ensure the active project and project index reflect missing-row removal in a predictable way.

### Requirements

Project persistence rules:

* Dismissed warnings do not change project JSON.
* Merged `fileAvailability` does not change project JSON.
* Removing missing rows changes project row visibility and should save the active project.
* The project index should update row counts after save.
* If the project save fails, the app should preserve the dirty state and show a clear project error.

Use the current snapshot builder and save path:

* `buildVideoProjectSnapshot`
* `useProjectWorkspace.saveProject`
* `projectClient.save`
* `projectService.saveProject`

If the current `saveProject` callback is not easy to call after row hiding because of stale closure timing, add a small save helper that builds from the latest `useVideoResultsStore.getState()` after `hideVideoPathsFromTable` completes.

Do not bump `PROJECT_SCHEMA_VERSION` unless persisted project shape changes.

### Deliverables

* Save-after-remove wiring
* Project index refresh/application after save
* Clear messages for success, save failure, and no-op removal

### Acceptance Criteria

* Remove-missing updates the visible row count in the project sidebar after save/refresh.
* Closing and reopening the project preserves the removed-row state.
* Dismiss-only sessions do not dirty or save the project.
* Project JSON does not persist stale availability checks.

---

## Stage 9 -- Verification And Cleanup

**Intelligence Level: Medium**

### Goal

Verify the feature against realistic project and external-drive behavior, then clean up any stale inline controller logic.

### Manual Verification Checklist

Use a small saved project and, if practical, one project with many rows.

Check:

```txt
open project with all files present
open project with one missing file
open project with multiple missing files
dismiss missing-file warning
confirm missing rows are visible but unselected
confirm missing row checkboxes are disabled
confirm changed rows remain selectable
remove missing rows from project
confirm table visible count changes
confirm project saves and project index counts update
close and reopen project after remove-missing
manual Check Files with no issues
manual Check Files with missing files
window focus recheck after throttle interval
window focus does not recheck repeatedly within throttle interval
start Auto-Fix with a selected file that disappeared after selection
start Auto-Crop with a selected file that disappeared after selection
start Premiere import with a selected file that disappeared after selection
generate selected thumbnails with a selected file that disappeared after selection
move/trash/archive selected rows with a selected file that disappeared after selection
run a fresh audit and confirm stale availability state clears
clear audit data and confirm availability state clears
```

### Code Cleanup

Remove or shrink:

* inline availability validation logic in `useVideoAuditAppController.ts`
* duplicated selectability checks
* stale file-availability copy that implies only project restore checks files

Keep:

* main/preload filesystem boundary
* `projectSnapshot` stripping transient `fileAvailability`
* Zustand as the focused row/selection owner

### Verification Commands

Follow the repo's current no-tests policy unless tests are explicitly requested.

Recommended checks:

```bash
npm run typecheck
npm run build
git diff --check
```

### Acceptance Criteria

* TypeScript compiles.
* Production build succeeds.
* No whitespace errors.
* Missing-file workflow is documented in the implementation summary.
* No renderer code directly imports or uses Node filesystem APIs.
