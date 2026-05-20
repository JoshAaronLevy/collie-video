import type { ReactElement, RefObject } from 'react';
import { Button } from 'primereact/button';
import { ScrollPanel } from 'primereact/scrollpanel';
import { Sidebar } from 'primereact/sidebar';
import { Tag } from 'primereact/tag';
import type { ProjectIndexItem } from '../../shared/types/project';

interface ProjectSidebarProps {
  visible: boolean;
  projects: ProjectIndexItem[];
  activeProjectId: string | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  onHide: () => void;
  onRefresh: () => void;
  onSaveCurrentProject: () => void;
  onOpenProject?: (projectId: string) => void;
  onRequestDeleteProject?: (projectId: string) => void;
}

export function ProjectSidebar({
  visible,
  projects,
  activeProjectId,
  isLoading,
  isSaving,
  error,
  onHide,
  onRefresh,
  onSaveCurrentProject,
  onOpenProject,
  onRequestDeleteProject
}: ProjectSidebarProps): ReactElement {
  return (
    <Sidebar
      visible={visible}
      position="right"
      modal
      blockScroll
      showCloseIcon={false}
      className="project-sidebar"
      onShow={onRefresh}
      onHide={onHide}
      content={({ hide, closeIconRef }) => (
        <aside className="project-sidebar-shell" aria-label="Saved projects">
          <header className="project-sidebar-header">
            <div>
              <p className="eyebrow">Workspace</p>
              <h2>Projects</h2>
            </div>
            <button
              ref={closeIconRef as RefObject<HTMLButtonElement | null>}
              type="button"
              className="project-sidebar-close"
              aria-label="Close projects"
              onClick={(event) => hide(event)}
            >
              <i className="pi pi-times" aria-hidden="true" />
            </button>
          </header>

          <section className="project-sidebar-save-panel" aria-label="Current project save">
            <div>
              <strong>Current workspace</strong>
              <span>{activeProjectId ? 'Save updates to the active project.' : 'Save this workspace as a project.'}</span>
            </div>
            <Button
              label="Save Current"
              icon="pi pi-save"
              severity="success"
              loading={isSaving}
              onClick={onSaveCurrentProject}
            />
          </section>

          {error ? (
            <section className="project-sidebar-state is-error" aria-label="Project error">
              <i className="pi pi-exclamation-triangle" aria-hidden="true" />
              <strong>Project action failed</strong>
              <span>{error}</span>
              <Button label="Refresh" icon="pi pi-refresh" severity="secondary" outlined onClick={onRefresh} />
            </section>
          ) : null}

          <section className="project-sidebar-body" aria-label="Saved project list">
            {isLoading ? (
              <ProjectSidebarState
                icon="pi pi-spin pi-spinner"
                title="Loading projects"
                detail="Checking saved project metadata."
              />
            ) : projects.length === 0 ? (
              <ProjectSidebarState
                icon="pi pi-folder-open"
                title="No saved projects"
                detail="Saved projects will appear here."
              />
            ) : (
              <ScrollPanel className="project-sidebar-list-scroll">
                <div className="project-sidebar-list">
                  {projects.map((project) => (
                    <ProjectSidebarItem
                      key={project.id}
                      project={project}
                      isActive={project.id === activeProjectId}
                      canOpen={Boolean(onOpenProject)}
                      canDelete={Boolean(onRequestDeleteProject)}
                      onOpen={() => onOpenProject?.(project.id)}
                      onRequestDelete={() => onRequestDeleteProject?.(project.id)}
                    />
                  ))}
                </div>
              </ScrollPanel>
            )}
          </section>
        </aside>
      )}
    />
  );
}

interface ProjectSidebarStateProps {
  icon: string;
  title: string;
  detail: string;
}

function ProjectSidebarState({ icon, title, detail }: ProjectSidebarStateProps): ReactElement {
  return (
    <div className="project-sidebar-state">
      <i className={icon} aria-hidden="true" />
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

interface ProjectSidebarItemProps {
  project: ProjectIndexItem;
  isActive: boolean;
  canOpen: boolean;
  canDelete: boolean;
  onOpen: () => void;
  onRequestDelete: () => void;
}

function ProjectSidebarItem({
  project,
  isActive,
  canOpen,
  canDelete,
  onOpen,
  onRequestDelete
}: ProjectSidebarItemProps): ReactElement {
  return (
    <article className={`project-card${isActive ? ' is-active' : ''}`} aria-label={project.name}>
      <header className="project-card-header">
        <div>
          <h3 title={project.name}>{project.name}</h3>
          <span>{formatDateTime(project.updatedAt, 'Updated')}</span>
        </div>
        {isActive ? <Tag value="Active" severity="success" /> : null}
      </header>

      <dl className="project-card-details">
        <div>
          <dt>Sources</dt>
          <dd title={project.sourceSummary}>{project.sourceSummary}</dd>
        </div>
        <div>
          <dt>Output</dt>
          <dd title={project.outputFolder ?? undefined}>{project.outputFolder ?? 'No output folder'}</dd>
        </div>
        <div>
          <dt>Last Run</dt>
          <dd>{project.lastRunAt ? formatDateTime(project.lastRunAt, 'Run') : 'Not run yet'}</dd>
        </div>
      </dl>

      <div className="project-card-counts" aria-label="Project row counts">
        <ProjectMetric label="Rows" value={project.rowCount} />
        <ProjectMetric label="Visible" value={project.visibleRowCount} />
        <ProjectMetric label="Removed" value={project.removedRowCount} />
        <ProjectMetric label="Flagged" value={project.flaggedCount} />
        <ProjectMetric label="Errors" value={project.errorCount} />
      </div>

      <footer className="project-card-actions">
        <Button
          label="Open"
          icon="pi pi-external-link"
          severity="info"
          outlined
          disabled={!canOpen}
          onClick={onOpen}
        />
        <Button
          label="Delete"
          icon="pi pi-trash"
          severity="danger"
          outlined
          disabled={!canDelete}
          onClick={onRequestDelete}
        />
      </footer>
    </article>
  );
}

interface ProjectMetricProps {
  label: string;
  value: number;
}

function ProjectMetric({ label, value }: ProjectMetricProps): ReactElement {
  return (
    <span>
      <strong>{value.toLocaleString()}</strong>
      <small>{label}</small>
    </span>
  );
}

function formatDateTime(value: string, prefix: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return prefix;
  }

  return `${prefix} ${date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })}`;
}
