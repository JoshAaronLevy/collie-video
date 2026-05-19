import { useCallback } from 'react';
import type { KnownPathValidationItem } from '../../shared/types/fileOperations';
import * as fileOperationsClient from '../api/fileOperationsClient';
import { getErrorMessage } from '../helpers/errors';

export type PathRevealActiveAction = 'reveal' | null;

interface UsePathRevealOptions {
  setSelectionMessage: (message: string | null) => void;
  setActiveAction: (action: PathRevealActiveAction) => void;
}

interface UsePathRevealValue {
  revealPath: (path: string) => Promise<void>;
  revealKnownFile: (item: KnownPathValidationItem) => Promise<void>;
  revealKnownFolder: (item: KnownPathValidationItem) => Promise<void>;
}

export function usePathReveal({
  setSelectionMessage,
  setActiveAction
}: UsePathRevealOptions): UsePathRevealValue {
  const revealPath = useCallback(async (path: string): Promise<void> => {
    setActiveAction('reveal');

    try {
      const validation = await fileOperationsClient.validateKnownPaths({
        items: [
          {
            path,
            expectedKind: 'any'
          }
        ]
      });
      const item = validation.items[0];

      if (!item?.isValid || !item.identity) {
        setSelectionMessage(item?.errors[0] ?? validation.message ?? 'Could not reveal that path in Finder.');
        return;
      }

      const result = item.identity.isDirectory
        ? await fileOperationsClient.revealFolder({
            path,
            expectedKind: 'directory',
            expectedFileName: item.identity.fileName
          })
        : await fileOperationsClient.revealFile({
            path,
            expectedKind: 'file',
            expectedFileName: item.identity.fileName
          });
      setSelectionMessage(result.ok ? null : (result.message ?? 'Could not reveal that path in Finder.'));
    } catch (error: unknown) {
      setSelectionMessage(getErrorMessage(error, 'Could not reveal that path in Finder.'));
    } finally {
      setActiveAction(null);
    }
  }, [setActiveAction, setSelectionMessage]);

  const revealKnownFile = useCallback(async (item: KnownPathValidationItem): Promise<void> => {
    setActiveAction('reveal');

    try {
      const result = await fileOperationsClient.revealFile({
        ...item,
        expectedKind: 'file'
      });
      setSelectionMessage(result.ok ? null : (result.message ?? 'Could not reveal that file in Finder.'));
    } catch (error: unknown) {
      setSelectionMessage(getErrorMessage(error, 'Could not reveal that file in Finder.'));
    } finally {
      setActiveAction(null);
    }
  }, [setActiveAction, setSelectionMessage]);

  const revealKnownFolder = useCallback(async (item: KnownPathValidationItem): Promise<void> => {
    setActiveAction('reveal');

    try {
      const result = await fileOperationsClient.revealFolder({
        ...item,
        expectedKind: 'directory'
      });
      setSelectionMessage(result.ok ? null : (result.message ?? 'Could not reveal that folder in Finder.'));
    } catch (error: unknown) {
      setSelectionMessage(getErrorMessage(error, 'Could not reveal that folder in Finder.'));
    } finally {
      setActiveAction(null);
    }
  }, [setActiveAction, setSelectionMessage]);

  return {
    revealPath,
    revealKnownFile,
    revealKnownFolder
  };
}
