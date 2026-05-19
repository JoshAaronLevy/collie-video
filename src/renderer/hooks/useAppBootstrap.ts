import { useEffect, useState } from 'react';
import type { AppInfo } from '../../shared/types/app';
import * as appClient from '../api/appClient';
import { getErrorMessage } from '../helpers/errors';

export interface UseAppBootstrapValue {
  appInfo: AppInfo | null;
  appInfoMessage: string | null;
}

export function useAppBootstrap(): UseAppBootstrapValue {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [appInfoMessage, setAppInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    appClient.getAppInfo()
      .then((info) => {
        if (isMounted) {
          setAppInfo(info);
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setAppInfoMessage(getErrorMessage(error, 'Could not read app info.'));
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    appInfo,
    appInfoMessage
  };
}
