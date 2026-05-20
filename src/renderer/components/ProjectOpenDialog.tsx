import type { ReactElement } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Message } from 'primereact/message';
import { Tag } from 'primereact/tag';
import type { AuditOptions, AuditRequest } from '../../shared/types/audit';
import type { VideoProject } from '../../shared/types/project';
import { DialogFooter, DialogHeader } from './DialogChrome';

interface ProjectOpenDialogProps {
  visible: boolean;
  project: VideoProject | null;
  isSubmitting: boolean;
  canOpenProject: boolean;
  onRestore: () => Promise<void>;
  onScanAgain: () => Promise<void>;
  onHide: () => void;
}

export function ProjectOpenDialog({
  visible,
  project,
  isSubmitting,
  canOpenProject,
  onRestore,
  onScanAgain,
  onHide
}: ProjectOpenDialogProps): ReactElement {
  const request = project?.audit.request ?? null;
  const canScanAgain = Boolean(request) && canOpenProject && !isSubmitting;
  const canRestore = Boolean(project) && canOpenProject && !isSubmitting;

  return (
    <Dialog
      header={
        <DialogHeader
          eyebrow="Project"
          title={project?.name ?? 'Open Project'}
          description="Choose how to open this saved workspace."
          meta={project ? <Tag value={formatUpdatedAt(project.updatedAt)} severity="info" /> : null}
        />
      }
      footer={
        <DialogFooter>
          <Button
            label="Cancel"
            icon="pi pi-times"
            severity="secondary"
            outlined
            disabled={isSubmitting}
            onClick={onHide}
          />
        </DialogFooter>
      }
      visible={visible}
      modal
      draggable={false}
      className="app-dialog project-open-dialog"
      onHide={() => {
        if (!isSubmitting) {
          onHide();
        }
      }}
    >
      {project ? (
        <div className="project-open-content">
          {!canOpenProject ? (
            <Message severity="warn" text="Finish or cancel the active workflow before opening a project." />
          ) : null}

          <section className="project-open-summary" aria-label="Saved project summary">
            <ProjectSummaryItem label="Folders" value={project.sources.selectedFolders.length} />
            <ProjectSummaryItem label="Files" value={project.sources.selectedFiles.length} />
            <ProjectSummaryItem label="Rows" value={project.audit.result?.videos.length ?? 0} />
            <ProjectSummaryItem
              label="Removed"
              value={project.audit.result?.videos.filter((row) => row.visible === false).length ?? 0}
            />
          </section>

          <section className="project-open-paths" aria-label="Saved project paths">
            <ProjectPathLine label="Output" value={project.sources.outputFolder ?? 'No output folder'} />
            <ProjectPathLine
              label="Request"
              value={request ? formatAuditRequest(request) : 'No saved audit request'}
            />
          </section>

          {request ? <AuditOptionSummary options={request.options} /> : (
            <Message
              severity="warn"
              text="Scan Again is unavailable because this project does not have a saved audit request."
            />
          )}

          <div className="project-open-actions" aria-label="Project open choices">
            <section>
              <div>
                <strong>Restore</strong>
                <span>Open saved sources, rows, filters, and hidden row state.</span>
              </div>
              <Button
                label="Restore"
                icon="pi pi-replay"
                severity="success"
                loading={isSubmitting}
                disabled={!canRestore}
                onClick={onRestore}
              />
            </section>

            <section>
              <div>
                <strong>Scan Again</strong>
                <span>Run the saved audit request again from this project.</span>
              </div>
              <Button
                label="Scan Again"
                icon="pi pi-refresh"
                severity="info"
                loading={isSubmitting}
                disabled={!canScanAgain}
                onClick={onScanAgain}
              />
            </section>
          </div>
        </div>
      ) : (
        <div className="project-open-content">
          <Message severity="info" text="Loading saved project." />
        </div>
      )}
    </Dialog>
  );
}

interface ProjectSummaryItemProps {
  label: string;
  value: number;
}

function ProjectSummaryItem({ label, value }: ProjectSummaryItemProps): ReactElement {
  return (
    <span>
      <strong>{value.toLocaleString()}</strong>
      <small>{label}</small>
    </span>
  );
}

interface ProjectPathLineProps {
  label: string;
  value: string;
}

function ProjectPathLine({ label, value }: ProjectPathLineProps): ReactElement {
  return (
    <div>
      <span>{label}</span>
      <code title={value}>{value}</code>
    </div>
  );
}

function AuditOptionSummary({ options }: { options: AuditOptions }): ReactElement {
  return (
    <section className="project-open-options" aria-label="Saved audit options">
      <Tag value={options.includeSubfolders ? 'Include subfolders' : 'Direct children only'} severity="info" />
      <Tag
        value={options.includeLowResolutionAnalysis ? 'Low-res enabled' : 'Low-res off'}
        severity={options.includeLowResolutionAnalysis ? 'success' : 'secondary'}
      />
      <Tag
        value={options.includeBlackBorderAnalysis ? 'Black-border enabled' : 'Black-border off'}
        severity={options.includeBlackBorderAnalysis ? 'success' : 'secondary'}
      />
      <Tag value={`Min ${options.minHeight}px`} severity="info" />
      <Tag value={`Aspect ${options.targetAspectRatio}`} severity="info" />
    </section>
  );
}

function formatAuditRequest(request: AuditRequest): string {
  const folderCount = request.folderPaths.length.toLocaleString();
  const fileCount = request.filePaths.length.toLocaleString();
  return `${folderCount} folder(s), ${fileCount} file(s)`;
}

function formatUpdatedAt(value: string): string {
  const updatedAt = new Date(value);

  if (Number.isNaN(updatedAt.getTime())) {
    return 'Saved project';
  }

  return `Updated ${updatedAt.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })}`;
}
