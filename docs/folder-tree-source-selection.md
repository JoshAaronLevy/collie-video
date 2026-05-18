# Folder Tree Source Selection

This document describes the implemented folder-tree source selection flow from
`folder-tree-source-selection-plan.md`.

## Overview

Folder selection is now centered on a PrimeReact `TreeTable` dialog instead of a
single basic folder picker. The user chooses one root folder, the Electron main
process eagerly scans the full folder tree under that root, and the renderer
displays the complete tree for local expansion and checkbox selection.

The original selected-file audit flow remains separate. Users can still select
individual video files through the file picker, and folder-tree selections are
combined with selected files only when an audit request is run.

## Source Selection Flow

1. Open source configuration from the main source summary bar.
2. Choose folder sources, which opens the folder-tree selector.
3. Choose or refresh a root folder.
4. The main process scans the full recursive folder tree.
5. The renderer receives one complete tree result.
6. Expanding folders in the `TreeTable` only changes local UI state.
7. Select the root, subfolders, or sibling folders with checkbox selection.
8. Confirm the selected folders.
9. The app stores deduped absolute folder paths as the active folder sources.
10. Run Audit uses those folder paths plus any separately selected files.

## Eager Scan Semantics

The folder tree scan is intentionally eager and complete.

- The main process owns all filesystem access.
- The renderer never directly imports or uses `fs`, `path`, Electron main APIs,
  or recursive filesystem walkers.
- Every non-skipped folder and subfolder under the selected root is included in
  the returned tree.
- Every folder node includes direct and recursive supported-video counts and
  supported-video sizes before the tree is displayed.
- Expanding a folder in the `TreeTable` does not call IPC and does not touch the
  filesystem.
- The scan does not run ffprobe, black-border analysis, thumbnail generation, or
  audit execution.

The eager behavior is deliberate. The target library has many files but not many
folders, and the previous web implementation was fast enough. Clarity is more
important here than lazy loading.

## Counts And Sizes

Each folder node carries these values:

- `directVideoCount`: supported video files directly inside that folder.
- `directVideoSizeBytes`: size of supported video files directly inside that
  folder.
- `totalVideoCount`: supported video files inside that folder and all included
  descendants.
- `totalVideoSizeBytes`: size of supported video files inside that folder and
  all included descendants.

The table displays recursive totals by default:

- `Videos` shows `totalVideoCount`.
- `Video Size` shows `totalVideoSizeBytes`.

Only supported video files are counted or summed. Unsupported files, `.DS_Store`,
AppleDouble files beginning with `._`, symlinks, known system folders, and known
app temp/trash/archive folders are skipped.

## Selection And Dedupe

The `TreeTable` uses controlled checkbox selection.

- The root folder can be selected.
- Any subfolder can be selected.
- Multiple folders across branches can be selected.
- Parent folders can appear partially selected when child folders are selected.
- Confirmed selected folders are absolute paths.

Before the selection becomes audit input, overlapping parent/child paths are
deduped. If a selected parent already includes a selected child, the parent is
kept and the child is omitted from the audit folder list.

Example:

```txt
Selected:
/Videos/Edited
/Videos/Edited/Tennis
/Videos/Edited/Family

Audited:
/Videos/Edited
```

Sibling selections are preserved:

```txt
Selected:
/Videos/Edited/Tennis
/Videos/Edited/Family

Audited:
/Videos/Edited/Tennis
/Videos/Edited/Family
```

The selected summary is calculated from the deduped selection so parent/child
overlaps do not double-count video totals or sizes.

## Include Subfolders

The folder tree always scans recursively so the user can inspect and select any
descendant folder.

Audit execution still respects the current `Include subfolders` option:

- Enabled: audit recursively includes videos under each deduped selected folder.
- Disabled: audit includes only videos directly inside each deduped selected
  folder.

The folder-tree selected summary mirrors that audit option. With subfolders
enabled, it displays recursive video totals. With subfolders disabled, it
displays direct-only video totals.

## Persistence

The app persists folder-tree source selection metadata in settings:

- last folder tree root path
- selected folder paths
- deduped selected folder paths
- selected-folder summary
- include-subfolders mode
- last scan timestamp

The app does not persist the scanned folder tree.

On reopen, selected folder sources and useful summary metadata can be restored,
but the actual tree is not loaded from disk. The user can manually refresh or
rescan the saved root to rebuild the tree from the current filesystem.

## No Caching Or Lazy Loading

Folder tree caching and lazy loading are intentionally not implemented.

- There is no IndexedDB folder-tree cache.
- There is no settings-backed folder-tree cache.
- There is no main-process folder-tree cache.
- Reopening the dialog with a saved root prompts a fresh scan.
- Expanding rows in the table never triggers additional API, IPC, or filesystem
  calls.

This keeps the feature predictable and avoids stale source-selection state.

## Error And Empty States

The dialog handles these states explicitly:

- no root selected
- saved root ready to rescan
- scan starting
- scan in progress
- canceled scan
- unavailable root
- no videos found
- root with no scanned subfolders
- unreadable or skipped folders
- previously selected folders missing from the current tree
- no folder selected for confirmation

Warnings are surfaced in the dialog, but skipped system/safety folders do not
block the user from selecting and auditing readable folders.

## Manual Verification Checklist

- [ ] Open the source configuration flow.
- [ ] Open the folder-tree selector.
- [ ] Choose a root folder.
- [ ] Verify the full tree scan starts and shows progress.
- [ ] Verify scan progress shows folders, videos, video size, and skipped count
      when applicable.
- [ ] Expand nested folders and verify no additional scan/API/filesystem call is
      needed.
- [ ] Select the root folder.
- [ ] Select one subfolder.
- [ ] Select sibling subfolders.
- [ ] Select a parent and child folder, confirm, and verify the selected source
      summary uses deduped folder counts.
- [ ] Confirm selected folders and verify the main source summary updates.
- [ ] Run an audit from selected folder-tree sources.
- [ ] Select individual files and verify selected-file audit still works.
- [ ] Toggle Include subfolders and verify folder audit behavior follows the
      option.
- [ ] Cancel an active folder-tree scan and verify the canceled state appears.
- [ ] Scan a root with no supported videos and verify the no-video state.
- [ ] Scan a root with unreadable/skipped folders if practical and verify the
      warning panel appears.
- [ ] Relaunch the app and verify selected folder-tree sources restore.
- [ ] Reopen the folder-tree selector after relaunch and verify the saved root
      can be rescanned without loading a cached tree.

## Implementation Map

- Shared types: `src/shared/types/folderTree.ts`
- Shared constants: `src/shared/constants/folderTree.ts`
- Main-process scanner: `src/main/services/folderTreeService.ts`
- Folder-tree IPC: `src/main/ipc/folderTreeIpc.ts`
- Preload API: `src/preload/videoAuditApi.ts`
- Renderer dialog: `src/renderer/components/source/FolderTreeSelectorDialog.tsx`
- Renderer table: `src/renderer/components/source/FolderTreeTable.tsx`
- Selection helpers: `src/renderer/helpers/folderTreeSelection.ts`
- Path dedupe helper: `src/shared/utils/folderPathSelection.ts`
- Settings persistence: `src/shared/types/settings.ts` and
  `src/main/services/settingsService.ts`
