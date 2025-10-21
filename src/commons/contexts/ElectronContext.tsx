import React, { createContext, useContext, useEffect, useState } from 'react';

interface ElectronContextType {
  isElectron: boolean;
  platform: string;
  version: string;
}

const ElectronContext = createContext<ElectronContextType>({
  isElectron: false,
  platform: 'unknown',
  version: 'unknown',
});

export const useElectron = () => useContext(ElectronContext);

export const ElectronProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [platform, setPlatform] = useState('unknown');
  const [version, setVersion] = useState('unknown');
  const isElectron = !!(window as any).electron;

  useEffect(() => {
    if (isElectron) {
      const electron = (window as any).electron;

      electron.app.getPlatform().then(setPlatform);
      electron.app.getVersion().then(setVersion);
    }
  }, [isElectron]);

  return (
    <ElectronContext.Provider value={{ isElectron, platform, version }}>
      {children}
    </ElectronContext.Provider>
  );
};
