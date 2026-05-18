import { useMemo, useRef, type ReactElement } from 'react';
import { Button } from 'primereact/button';
import { Menu } from 'primereact/menu';
import type { MenuItem } from 'primereact/menuitem';
import type { VideoRow } from '../../shared/types/video';

interface SelectionActionBarProps {
  rowsExist: boolean;
  selectedVideos: VideoRow[];
  removedVideoCount: number;
  isAuditActive: boolean;
  isAutoFixActive: boolean;
  isAutoCropActive: boolean;
  isMediaPreviewActive: boolean;
  isMigrationActive: boolean;
  isPremiereImportSubmitting: boolean;
  canAutoFixSelected: boolean;
  canOpenCropOptions: boolean;
  canGenerateThumbnails: boolean;
  canStartMigration: boolean;
  canEditSelectedInPremiere: boolean;
  onRemoveSelectedVideos: () => void;
  onRestoreRemovedVideos: () => void;
  onOpenAutoFixDialog: () => void;
  onOpenAutoCropDialog: () => void;
  onOpenThumbnailDialog: () => void;
  onOpenMigrationDialog: () => void;
  onEditSelectedInPremiere: () => void;
}

export function SelectionActionBar({
  rowsExist,
  selectedVideos,
  removedVideoCount,
  isAuditActive,
  isAutoFixActive,
  isAutoCropActive,
  isMediaPreviewActive,
  isMigrationActive,
  isPremiereImportSubmitting,
  canAutoFixSelected,
  canOpenCropOptions,
  canGenerateThumbnails,
  canStartMigration,
  canEditSelectedInPremiere,
  onRemoveSelectedVideos,
  onRestoreRemovedVideos,
  onOpenAutoFixDialog,
  onOpenAutoCropDialog,
  onOpenThumbnailDialog,
  onOpenMigrationDialog,
  onEditSelectedInPremiere
}: SelectionActionBarProps): ReactElement | null {
  const menuRef = useRef<Menu>(null);
  const selectedCount = selectedVideos.length;
  const hasSelection = selectedCount > 0;
  const hasOverflowActions = hasSelection || removedVideoCount > 0 || canStartMigration || canGenerateThumbnails;
  const overflowItems = useMemo<MenuItem[]>(
    () => {
      const items: MenuItem[] = [];

      if (!hasSelection && canGenerateThumbnails) {
        items.push({
          label: 'Generate All Thumbnails',
          icon: 'pi pi-images',
          disabled: isMediaPreviewActive,
          command: onOpenThumbnailDialog
        });
      }

      if (canStartMigration) {
        items.push({
          label: 'Migrate New Edits',
          icon: 'pi pi-folder-open',
          disabled: isMigrationActive,
          command: onOpenMigrationDialog
        });
      }

      if (items.length > 0 && (removedVideoCount > 0 || hasSelection)) {
        items.push({ separator: true });
      }

      if (hasSelection) {
        items.push({
          label: `Remove from Table (${selectedCount.toLocaleString()})`,
          icon: 'pi pi-eye-slash',
          disabled: isAuditActive,
          command: onRemoveSelectedVideos
        });
      }

      if (removedVideoCount > 0) {
        items.push({
          label: `Restore Removed (${removedVideoCount.toLocaleString()})`,
          icon: 'pi pi-undo',
          disabled: isAuditActive,
          command: onRestoreRemovedVideos
        });
      }

      return items;
    },
    [
      canGenerateThumbnails,
      canStartMigration,
      hasSelection,
      isAuditActive,
      isMediaPreviewActive,
      isMigrationActive,
      onOpenMigrationDialog,
      onOpenThumbnailDialog,
      onRemoveSelectedVideos,
      onRestoreRemovedVideos,
      removedVideoCount,
      selectedCount
    ]
  );

  if (!rowsExist && removedVideoCount === 0) {
    return null;
  }

  return (
    <section
      className={`selection-action-bar ${hasSelection ? 'is-active' : 'is-idle'}`}
      aria-label="Selected video actions"
    >
      <div className="selection-action-copy">
        <strong>
          {hasSelection
            ? `${selectedCount.toLocaleString()} selected`
            : 'No videos selected'}
        </strong>
        <span>
          {hasSelection ? formatSelectedSummary(selectedVideos) : getNoSelectionMessage(rowsExist, removedVideoCount)}
        </span>
      </div>

      <div className="selection-action-buttons">
        {hasSelection ? (
          <>
            <Button
              label="Auto-Fix"
              icon="pi pi-wrench"
              severity="help"
              loading={isAutoFixActive}
              disabled={!canAutoFixSelected}
              title={canAutoFixSelected ? 'Open Auto-Fix options for selected rows.' : getBusyDisabledReason()}
              onClick={onOpenAutoFixDialog}
            />
            <Button
              label="Crop Options"
              icon="pi pi-crop"
              severity="help"
              loading={isAutoCropActive}
              disabled={!canOpenCropOptions}
              title={canOpenCropOptions ? 'Open crop options for selected rows.' : getBusyDisabledReason()}
              onClick={onOpenAutoCropDialog}
            />
            <Button
              label="Generate Thumbnails"
              icon="pi pi-images"
              severity="info"
              loading={isMediaPreviewActive}
              disabled={!canGenerateThumbnails}
              title={canGenerateThumbnails ? 'Open thumbnail generation options.' : getBusyDisabledReason()}
              onClick={onOpenThumbnailDialog}
            />
            <Button
              label="Edit in Premiere"
              icon="pi pi-send"
              severity="success"
              loading={isPremiereImportSubmitting}
              disabled={!canEditSelectedInPremiere}
              title={
                canEditSelectedInPremiere
                  ? 'Send selected rows to Premiere.'
                  : 'Premiere bridge must be ready and no workflow can be active.'
              }
              onClick={onEditSelectedInPremiere}
            />
          </>
        ) : null}
        {hasOverflowActions ? (
          <>
            <Menu id="selection-action-more-menu" model={overflowItems} popup ref={menuRef} />
            <Button
              label="More"
              icon="pi pi-ellipsis-h"
              severity="secondary"
              outlined
              aria-haspopup
              aria-controls="selection-action-more-menu"
              onClick={(event) => menuRef.current?.toggle(event)}
            />
          </>
        ) : null}
      </div>
    </section>
  );
}

function formatSelectedSummary(rows: VideoRow[]): string {
  return `${formatSelectedSize(rows)} selected`;
}

function formatSelectedSize(rows: VideoRow[]): string {
  const sizeMB = rows.reduce((total, row) => total + (row.sizeMB ?? 0), 0);

  if (sizeMB >= 1024) {
    return `${(sizeMB / 1024).toFixed(2)} GB`;
  }

  return `${sizeMB.toFixed(1)} MB`;
}

function getNoSelectionMessage(rowsExist: boolean, removedVideoCount: number): string {
  if (removedVideoCount > 0) {
    return `${removedVideoCount.toLocaleString()} removed row(s) can be restored from More.`;
  }

  if (rowsExist) {
    return 'Select rows for Auto-Fix, Crop, thumbnails, or Premiere.';
  }

  return 'Run an audit to enable row actions.';
}

function getBusyDisabledReason(): string {
  return 'Select rows and wait for active workflows to finish.';
}
