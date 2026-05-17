import { type ReactElement, useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { Card } from 'primereact/card';
import { Checkbox } from 'primereact/checkbox';
import { Divider } from 'primereact/divider';
import { InputText } from 'primereact/inputtext';
import { Message } from 'primereact/message';
import { Tag } from 'primereact/tag';
import type { AppInfo } from '../shared/types/app';
import type { PathSelectionResult } from '../shared/types/dialog';
import type { AppSettings, AppSettingsUpdate } from '../shared/types/settings';

type DialogAction = 'folders' | 'files' | 'output' | 'reveal' | 'settings';

export function App(): ReactElement {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [outputFolder, setOutputFolder] = useState<string | null>(null);
  const [selectionMessage, setSelectionMessage] = useState<string | null>(null);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<DialogAction | null>(null);

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

  useEffect(() => {
    let isMounted = true;

    window.videoAudit.settings
      .get()
      .then((loadedSettings) => {
        if (isMounted) {
          setSettings(loadedSettings);
          setOutputFolder(loadedSettings.defaultOutputDirectory);
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setSettingsMessage(error instanceof Error ? error.message : 'Could not load settings.');
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSelectionResult = (
    result: PathSelectionResult,
    onValidPaths: (paths: string[]) => void
  ): void => {
    if (result.canceled) {
      setSelectionMessage(null);
      return;
    }

    onValidPaths(result.paths);
    setSelectionMessage(
      result.invalidPaths.length > 0
        ? `${result.invalidPaths.length} selected path(s) could not be used.`
        : null
    );
  };

  const persistSettings = async (partialSettings: AppSettingsUpdate): Promise<AppSettings | null> => {
    setActiveAction('settings');
    try {
      const updatedSettings = await window.videoAudit.settings.update(partialSettings);
      setSettings(updatedSettings);
      setSettingsMessage('Settings saved.');
      return updatedSettings;
    } catch (error: unknown) {
      setSettingsMessage(error instanceof Error ? error.message : 'Could not save settings.');
      return null;
    } finally {
      setActiveAction(null);
    }
  };

  const chooseFolders = async (): Promise<void> => {
    setActiveAction('folders');
    try {
      const result = await window.videoAudit.dialog.chooseFolders();
      handleSelectionResult(result, setSelectedFolders);
      if (!result.canceled && result.paths.length > 0) {
        await persistSettings({
          recentFolders: mergeRecentPaths(result.paths, settings?.recentFolders ?? []),
          latestSelectedFolder: result.paths[0]
        });
      }
    } catch (error: unknown) {
      setSelectionMessage(error instanceof Error ? error.message : 'Could not choose folders.');
    } finally {
      setActiveAction(null);
    }
  };

  const chooseFiles = async (): Promise<void> => {
    setActiveAction('files');
    try {
      const result = await window.videoAudit.dialog.chooseVideoFiles();
      handleSelectionResult(result, setSelectedFiles);
      if (!result.canceled && result.paths.length > 0) {
        await persistSettings({
          recentFiles: mergeRecentPaths(result.paths, settings?.recentFiles ?? [])
        });
      }
    } catch (error: unknown) {
      setSelectionMessage(error instanceof Error ? error.message : 'Could not choose files.');
    } finally {
      setActiveAction(null);
    }
  };

  const chooseOutputFolder = async (): Promise<void> => {
    setActiveAction('output');
    try {
      const result = await window.videoAudit.dialog.chooseOutputFolder();
      handleSelectionResult(result, (paths) => setOutputFolder(paths[0] ?? null));
      if (!result.canceled && result.paths[0]) {
        await persistSettings({
          defaultOutputDirectory: result.paths[0]
        });
      }
    } catch (error: unknown) {
      setSelectionMessage(error instanceof Error ? error.message : 'Could not choose an output folder.');
    } finally {
      setActiveAction(null);
    }
  };

  const revealPath = async (path: string): Promise<void> => {
    setActiveAction('reveal');
    try {
      const result = await window.videoAudit.shell.revealPath(path);
      setSelectionMessage(result.ok ? null : (result.message ?? 'Could not reveal that path in Finder.'));
    } catch (error: unknown) {
      setSelectionMessage(error instanceof Error ? error.message : 'Could not reveal that path in Finder.');
    } finally {
      setActiveAction(null);
    }
  };

  const updateSettingsField = async <Key extends keyof AppSettings>(
    key: Key,
    value: AppSettings[Key]
  ): Promise<void> => {
    await persistSettings({ [key]: value } as AppSettingsUpdate);
  };

  const resetSettings = async (): Promise<void> => {
    setActiveAction('settings');
    try {
      const reset = await window.videoAudit.settings.reset();
      setSettings(reset);
      setOutputFolder(reset.defaultOutputDirectory);
      setSettingsMessage('Settings reset.');
    } catch (error: unknown) {
      setSettingsMessage(error instanceof Error ? error.message : 'Could not reset settings.');
    } finally {
      setActiveAction(null);
    }
  };

  return (
    <main className="app-shell">
      <section className="hero-band">
        <div className="hero-copy">
          <Tag value="Local settings" severity="info" />
          <h1>Video Audit</h1>
          <p>
            A private macOS utility for finding video files that need review before editing.
          </p>
        </div>
        <Button label="Stage 4 ready" icon="pi pi-save" disabled />
      </section>

      <section className="content-grid">
        <Card title="Select Sources">
          <div className="selection-panel">
            <p className="body-copy">
              Choose local folders or individual video files with native macOS dialogs. Auditing
              starts in a later stage; this screen only captures validated absolute paths.
            </p>

            <div className="button-row">
              <Button
                label="Choose Folder"
                icon="pi pi-folder-open"
                loading={activeAction === 'folders'}
                onClick={chooseFolders}
              />
              <Button
                label="Choose Files"
                icon="pi pi-video"
                severity="secondary"
                loading={activeAction === 'files'}
                onClick={chooseFiles}
              />
              <Button
                label="Choose Output Folder"
                icon="pi pi-download"
                severity="help"
                loading={activeAction === 'output'}
                onClick={chooseOutputFolder}
              />
            </div>

            {selectionMessage ? <Message severity="warn" text={selectionMessage} /> : null}

            <div className="path-grid">
              <SelectedPathList
                title="Folders"
                emptyLabel="No folders selected"
                paths={selectedFolders}
                onReveal={revealPath}
                revealDisabled={activeAction === 'reveal'}
              />
              <SelectedPathList
                title="Video Files"
                emptyLabel="No files selected"
                paths={selectedFiles}
                onReveal={revealPath}
                revealDisabled={activeAction === 'reveal'}
              />
              <SelectedPathList
                title="Output Folder"
                emptyLabel="No output folder selected"
                paths={outputFolder ? [outputFolder] : []}
                onReveal={revealPath}
                revealDisabled={activeAction === 'reveal'}
              />
            </div>
          </div>
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

        <Card title="Settings">
          {settings ? (
            <div className="settings-panel">
              <div className="settings-grid">
                <BooleanSetting
                  label="Include subfolders"
                  checked={settings.includeSubfoldersDefault}
                  disabled={activeAction === 'settings'}
                  onChange={(checked) => updateSettingsField('includeSubfoldersDefault', checked)}
                />
                <BooleanSetting
                  label="Low-resolution analysis"
                  checked={settings.lowResolutionAnalysisEnabledDefault}
                  disabled={activeAction === 'settings'}
                  onChange={(checked) =>
                    updateSettingsField('lowResolutionAnalysisEnabledDefault', checked)
                  }
                />
                <BooleanSetting
                  label="Black-border analysis"
                  checked={settings.blackBorderAnalysisEnabledDefault}
                  disabled={activeAction === 'settings'}
                  onChange={(checked) =>
                    updateSettingsField('blackBorderAnalysisEnabledDefault', checked)
                  }
                />
              </div>

              <TextSetting
                label="Auto-fix destination"
                value={settings.defaultAutoFixDestinationRoot}
                disabled={activeAction === 'settings'}
                onSave={(value) => updateSettingsField('defaultAutoFixDestinationRoot', value)}
              />
              <TextSetting
                label="ffmpeg path override"
                value={settings.ffmpegPathOverride}
                disabled={activeAction === 'settings'}
                onSave={(value) => updateSettingsField('ffmpegPathOverride', value)}
              />
              <TextSetting
                label="ffprobe path override"
                value={settings.ffprobePathOverride}
                disabled={activeAction === 'settings'}
                onSave={(value) => updateSettingsField('ffprobePathOverride', value)}
              />

              {settingsMessage ? <Message severity="info" text={settingsMessage} /> : null}

              <div className="settings-summary">
                <InfoRow label="Recent folders" value={String(settings.recentFolders.length)} />
                <InfoRow label="Recent files" value={String(settings.recentFiles.length)} />
                <InfoRow label="Latest folder" value={settings.latestSelectedFolder ?? 'None'} />
                <InfoRow label="Default output" value={settings.defaultOutputDirectory ?? 'None'} />
              </div>

              <Button
                label="Reset Settings"
                icon="pi pi-refresh"
                severity="secondary"
                outlined
                loading={activeAction === 'settings'}
                onClick={resetSettings}
              />
            </div>
          ) : (
            <p className="empty-copy">{settingsMessage ?? 'Loading settings...'}</p>
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

function BooleanSetting({
  label,
  checked,
  disabled,
  onChange
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}): ReactElement {
  const inputId = `setting-${label.toLowerCase().replaceAll(' ', '-')}`;

  return (
    <label className="checkbox-setting" htmlFor={inputId}>
      <Checkbox
        inputId={inputId}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(Boolean(event.checked))}
      />
      <span>{label}</span>
    </label>
  );
}

function TextSetting({
  label,
  value,
  disabled,
  onSave
}: {
  label: string;
  value: string | null;
  disabled: boolean;
  onSave: (value: string | null) => void;
}): ReactElement {
  const [draftValue, setDraftValue] = useState(value ?? '');
  const inputId = `setting-${label.toLowerCase().replaceAll(' ', '-')}`;

  useEffect(() => {
    setDraftValue(value ?? '');
  }, [value]);

  return (
    <div className="text-setting">
      <label htmlFor={inputId}>{label}</label>
      <div className="text-setting-row">
        <InputText
          id={inputId}
          value={draftValue}
          disabled={disabled}
          onChange={(event) => setDraftValue(event.target.value)}
          placeholder="Not set"
        />
        <Button
          label="Save"
          icon="pi pi-check"
          severity="secondary"
          outlined
          disabled={disabled}
          onClick={() => onSave(draftValue.trim() === '' ? null : draftValue.trim())}
        />
      </div>
    </div>
  );
}

function mergeRecentPaths(nextPaths: string[], currentPaths: string[]): string[] {
  return [...new Set([...nextPaths, ...currentPaths])].slice(0, 10);
}

function SelectedPathList({
  title,
  emptyLabel,
  paths,
  onReveal,
  revealDisabled
}: {
  title: string;
  emptyLabel: string;
  paths: string[];
  onReveal: (path: string) => void;
  revealDisabled: boolean;
}): ReactElement {
  return (
    <section className="path-section" aria-label={title}>
      <div className="path-section-header">
        <h2>{title}</h2>
        <Tag value={String(paths.length)} severity={paths.length > 0 ? 'success' : 'secondary'} />
      </div>

      {paths.length > 0 ? (
        <ul className="path-list">
          {paths.map((path) => (
            <li key={path} className="path-item">
              <span title={path}>{path}</span>
              <Button
                aria-label={`Reveal ${path} in Finder`}
                icon="pi pi-external-link"
                severity="secondary"
                text
                rounded
                disabled={revealDisabled}
                onClick={() => onReveal(path)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-copy">{emptyLabel}</p>
      )}
    </section>
  );
}
