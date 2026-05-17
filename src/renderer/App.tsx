import { type ReactElement, useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { Card } from 'primereact/card';
import { Divider } from 'primereact/divider';
import { Tag } from 'primereact/tag';
import type { AppInfo } from '../shared/types/app';

export function App(): ReactElement {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    window.videoAudit.app
      .getInfo()
      .then((info) => {
        if (isMounted) {
          setAppInfo(info);
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : 'Could not read app info.');
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="app-shell">
      <section className="hero-band">
        <div className="hero-copy">
          <Tag value="Electron scaffold" severity="info" />
          <h1>Video Audit</h1>
          <p>
            A private macOS utility for finding video files that need review before editing.
          </p>
        </div>
        <Button label="Stage 1 ready" icon="pi pi-check" disabled />
      </section>

      <section className="content-grid">
        <Card title="Home">
          <p className="body-copy">
            Native folder selection, auditing, thumbnails, migration, and Premiere handoff will
            arrive in later stages. This first pass proves the Electron shell, React renderer,
            PrimeReact styling, and preload IPC boundary are wired together.
          </p>
        </Card>

        <Card title="App Info">
          {errorMessage ? (
            <p className="error-copy">{errorMessage}</p>
          ) : (
            <dl className="info-list" aria-label="Application information">
              <InfoRow label="App" value={appInfo?.name ?? 'Loading...'} />
              <InfoRow label="Version" value={appInfo?.version ?? 'Loading...'} />
              <InfoRow label="Platform" value={appInfo?.platform ?? 'Loading...'} />
              <Divider />
              <InfoRow label="Electron" value={appInfo?.electronVersion ?? 'Loading...'} />
              <InfoRow label="Chrome" value={appInfo?.chromeVersion ?? 'Loading...'} />
              <InfoRow label="Node" value={appInfo?.nodeVersion ?? 'Loading...'} />
            </dl>
          )}
        </Card>
      </section>
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="info-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
