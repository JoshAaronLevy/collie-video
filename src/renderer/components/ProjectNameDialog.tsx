import { useEffect, useState, type ReactElement } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Message } from 'primereact/message';
import { DialogFooter, DialogHeader } from './DialogChrome';

const MAX_PROJECT_NAME_LENGTH = 120;

interface ProjectNameDialogProps {
  visible: boolean;
  error: string | null;
  isSaving: boolean;
  onSave: (name: string) => Promise<boolean>;
  onHide: () => void;
}

export function ProjectNameDialog({
  visible,
  error,
  isSaving,
  onSave,
  onHide
}: ProjectNameDialogProps): ReactElement {
  const [projectName, setProjectName] = useState('');
  const normalizedProjectName = normalizeProjectName(projectName);
  const canSave = normalizedProjectName.length > 0 && !isSaving;

  useEffect(() => {
    if (visible) {
      setProjectName('');
    }
  }, [visible]);

  const handleSave = async (): Promise<void> => {
    if (!canSave) {
      return;
    }

    const saved = await onSave(normalizedProjectName);

    if (saved) {
      setProjectName('');
    }
  };

  return (
    <Dialog
      header={
        <DialogHeader
          eyebrow="Project"
          title="Save Project"
          description="Name this workspace before saving it."
        />
      }
      footer={
        <DialogFooter>
          <Button
            label="Cancel"
            icon="pi pi-times"
            severity="secondary"
            outlined
            disabled={isSaving}
            onClick={onHide}
          />
          <Button
            label="Save"
            icon="pi pi-save"
            severity="success"
            loading={isSaving}
            disabled={!canSave}
            onClick={handleSave}
          />
        </DialogFooter>
      }
      visible={visible}
      modal
      draggable={false}
      className="app-dialog project-name-dialog"
      onHide={() => {
        if (!isSaving) {
          onHide();
        }
      }}
    >
      <div className="project-name-dialog-content">
        {error ? <Message severity="error" text={error} /> : null}

        <label className="project-name-field">
          <span>Project name</span>
          <InputText
            value={projectName}
            autoFocus
            maxLength={MAX_PROJECT_NAME_LENGTH}
            placeholder="Untitled Project"
            disabled={isSaving}
            onChange={(event) => setProjectName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void handleSave();
              }
            }}
          />
        </label>
      </div>
    </Dialog>
  );
}

function normalizeProjectName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, MAX_PROJECT_NAME_LENGTH);
}
