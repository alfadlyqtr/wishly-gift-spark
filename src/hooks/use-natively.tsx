import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { NativelyInfo, useNatively } from 'natively';

interface BrowserInfo {
  isNativeApp: boolean;
  isAndroid: boolean;
  isIOS: boolean;
  appVersion?: string;
  buildNumber?: string;
}

interface NativelyContextValue {
  natively: ReturnType<typeof useNatively> | null;
  browserInfo: BrowserInfo;
  isNativeApp: boolean;
  openConsole: () => void;
}

const defaultBrowserInfo: BrowserInfo = {
  isNativeApp: false,
  isAndroid: false,
  isIOS: false,
};

const NativelyContext = createContext<NativelyContextValue>({
  natively: null,
  browserInfo: defaultBrowserInfo,
  isNativeApp: false,
  openConsole: () => {},
});

export const NativelyProvider = ({ children }: { children: ReactNode }) => {
  const natively = useNatively();
  const [browserInfo, setBrowserInfo] = useState<BrowserInfo>(defaultBrowserInfo);

  useEffect(() => {
    try {
      const info = new NativelyInfo();
      const result = info.browserInfo();
      setBrowserInfo({
        isNativeApp: (result.isNativeApp ?? result.isIOSApp ?? result.isAndroidApp) ?? false,
        isAndroid: result.isAndroidApp ?? false,
        isIOS: result.isIOSApp ?? false,
        appVersion: undefined,
        buildNumber: undefined,
      });

      if (import.meta.env.DEV) {
        console.log('[Natively] Browser info:', result);
      }
    } catch (err) {
      console.warn('[Natively] Failed to get browser info:', err);
    }
  }, []);

  const openConsole = () => {
    try {
      natively?.openConsole();
    } catch (err) {
      console.warn('[Natively] openConsole not available:', err);
    }
  };

  return (
    <NativelyContext.Provider
      value={{
        natively,
        browserInfo,
        isNativeApp: browserInfo.isNativeApp,
        openConsole,
      }}
    >
      {children}
    </NativelyContext.Provider>
  );
};

export const useNativelyContext = () => useContext(NativelyContext);

export { useNatively } from 'natively';
