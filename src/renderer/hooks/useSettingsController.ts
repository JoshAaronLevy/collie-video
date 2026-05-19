import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AppSettings,
  AppSettingsUpdate
} from '../../shared/types/settings';
import * as settingsClient from '../api/settingsClient';
import { getErrorMessage } from '../helpers/errors';

interface UseSettingsControllerOptions {
  onSettingsActiveChange: (isActive: boolean) => void;
}

interface SaveSettingsOptions {
  successMessage?: string | null;
  errorMessage: string | null;
  markActive?: boolean;
  throwOnError?: boolean;
}

export interface UseSettingsControllerValue {
  settings: AppSettings | null;
  settingsMessage: string | null;
  setSettingsMessage: (message: string | null) => void;
  loadSettings: () => Promise<AppSettings>;
  persistSettings: (partialSettings: AppSettingsUpdate) => Promise<AppSettings | null>;
  saveSettingsSilently: (
    partialSettings: AppSettingsUpdate,
    options?: { errorMessage?: string | null; throwOnError?: boolean }
  ) => Promise<AppSettings | null>;
  updateSettingsField: <Key extends keyof AppSettings>(key: Key, value: AppSettings[Key]) => Promise<void>;
  resetSettings: () => Promise<AppSettings | null>;
}

export function useSettingsController({
  onSettingsActiveChange
}: UseSettingsControllerOptions): UseSettingsControllerValue {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const applySettings = useCallback((nextSettings: AppSettings, message?: string | null): void => {
    if (!isMountedRef.current) {
      return;
    }

    setSettings(nextSettings);

    if (message !== undefined) {
      setSettingsMessage(message);
    }
  }, []);

  const loadSettings = useCallback(async (): Promise<AppSettings> => {
    try {
      const loadedSettings = await settingsClient.getSettings();
      applySettings(loadedSettings);
      return loadedSettings;
    } catch (error: unknown) {
      if (isMountedRef.current) {
        setSettingsMessage(getErrorMessage(error, 'Could not load settings.'));
      }

      throw error;
    }
  }, [applySettings]);

  const saveSettings = useCallback(
    async (
      partialSettings: AppSettingsUpdate,
      {
        successMessage,
        errorMessage,
        markActive = true,
        throwOnError = false
      }: SaveSettingsOptions
    ): Promise<AppSettings | null> => {
      if (markActive) {
        onSettingsActiveChange(true);
      }

      try {
        const updatedSettings = await settingsClient.updateSettings(partialSettings);
        applySettings(updatedSettings, successMessage);
        return updatedSettings;
      } catch (error: unknown) {
        if (isMountedRef.current && errorMessage !== null) {
          setSettingsMessage(getErrorMessage(error, errorMessage));
        }

        if (throwOnError) {
          throw error;
        }

        return null;
      } finally {
        if (markActive) {
          onSettingsActiveChange(false);
        }
      }
    },
    [applySettings, onSettingsActiveChange]
  );

  const persistSettings = useCallback(
    async (partialSettings: AppSettingsUpdate): Promise<AppSettings | null> => {
      return saveSettings(partialSettings, {
        successMessage: 'Settings saved.',
        errorMessage: 'Could not save settings.'
      });
    },
    [saveSettings]
  );

  const saveSettingsSilently = useCallback(
    async (
      partialSettings: AppSettingsUpdate,
      options: { errorMessage?: string | null; throwOnError?: boolean } = {}
    ): Promise<AppSettings | null> => {
      return saveSettings(partialSettings, {
        successMessage: null,
        errorMessage: options.errorMessage ?? 'Could not save settings.',
        markActive: false,
        throwOnError: options.throwOnError
      });
    },
    [saveSettings]
  );

  const updateSettingsField = useCallback(
    async <Key extends keyof AppSettings>(key: Key, value: AppSettings[Key]): Promise<void> => {
      await persistSettings({ [key]: value } as AppSettingsUpdate);
    },
    [persistSettings]
  );

  const resetSettings = useCallback(async (): Promise<AppSettings | null> => {
    onSettingsActiveChange(true);

    try {
      const reset = await settingsClient.resetSettings();
      applySettings(reset, 'Settings reset.');
      return reset;
    } catch (error: unknown) {
      if (isMountedRef.current) {
        setSettingsMessage(getErrorMessage(error, 'Could not reset settings.'));
      }

      return null;
    } finally {
      onSettingsActiveChange(false);
    }
  }, [applySettings, onSettingsActiveChange]);

  return {
    settings,
    settingsMessage,
    setSettingsMessage,
    loadSettings,
    persistSettings,
    saveSettingsSilently,
    updateSettingsField,
    resetSettings
  };
}
