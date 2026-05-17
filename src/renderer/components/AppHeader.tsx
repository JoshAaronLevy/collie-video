import type { ReactElement } from 'react';
import { Tag } from 'primereact/tag';
import type { AppInfo } from '../../shared/types/app';

interface AppHeaderProps {
  appInfo: AppInfo | null;
}

export function AppHeader({ appInfo }: AppHeaderProps): ReactElement {
  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">Video Audit</p>
        <h1>Audit Workspace</h1>
      </div>
      <div className="header-meta">
        <Tag value={`v${appInfo?.version ?? '...'}`} severity="info" />
        <Tag value={appInfo?.platform ?? 'macOS'} severity="secondary" />
      </div>
    </header>
  );
}
