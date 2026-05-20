import type { ReactElement } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Message } from 'primereact/message';
import type { ProjectIndexItem } from '../../shared/types/project';
import { DialogFooter, DialogHeader } from './DialogChrome';

interface ProjectDeleteDialogProps {
  visible: boolean;
  project: ProjectIndexItem | null;
  error: string | null;
  isSubmitting: boolean;
  onConfirm: () => Promise<void>;
  onHide: () => void;
}

export function ProjectDeleteDialog({
  visible,
  project,
  error,
  isSubmitting,
  onConfirm,
  onHide
}: ProjectDeleteDialogProps): ReactElement {
  const title = project ? `Delete "${project.name}"?` : 'Delete Project?';

  return (
    <Dialog
      header={
        <DialogHeader
          eyebrow="Project"
          title={title}
          description="This removes the saved project from Collie Video. It does not delete source videos or output files."
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
          <Button
            label="Delete"
            icon="pi pi-trash"
            severity="danger"
            loading={isSubmitting}
            disabled={!project || isSubmitting}
            onClick={onConfirm}
          />
        </DialogFooter>
      }
      visible={visible}
      modal
      draggable={false}
      className="app-dialog project-delete-dialog"
      onHide={() => {
        if (!isSubmitting) {
          onHide();
        }
      }}
    >
      <div className="project-delete-content">
        {error ? <Message severity="error" text={error} /> : null}

        {project ? (
          <>
            <Message
              severity="warn"
              text="Only the app-managed saved project file and project index entry will be removed."
            />

            <section className="project-delete-details" aria-label="Saved project delete summary">
              <div>
                <span>Project</span>
                <strong title={project.name}>{project.name}</strong>
              </div>
              <div>
                <span>Sources</span>
                <code title={project.sourceSummary}>{project.sourceSummary}</code>
              </div>
              <div>
                <span>Output</span>
                <code title={project.outputFolder ?? undefined}>{project.outputFolder ?? 'No output folder'}</code>
              </div>
            </section>
          </>
        ) : (
          <Message severity="info" text="Choose a saved project to delete." />
        )}
      </div>
    </Dialog>
  );
}
