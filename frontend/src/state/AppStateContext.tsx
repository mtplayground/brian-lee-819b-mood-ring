import { createContext, useContext, useMemo, useState, type PropsWithChildren } from "react";
import type { ClientConfig } from "../api/config";

export type AppThemeMode = "system" | "light" | "dark";

export type AppState = {
  config: ClientConfig;
  themeMode: AppThemeMode;
  setThemeMode: (themeMode: AppThemeMode) => void;
};

const AppStateContext = createContext<AppState | null>(null);

type AppStateProviderProps = PropsWithChildren<{
  config: ClientConfig;
}>;

export function AppStateProvider({ children, config }: AppStateProviderProps) {
  const [themeMode, setThemeMode] = useState<AppThemeMode>("system");

  const value = useMemo<AppState>(
    () => ({
      config,
      themeMode,
      setThemeMode,
    }),
    [config, themeMode],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppState {
  const value = useContext(AppStateContext);

  if (!value) {
    throw new Error("useAppState must be used within AppStateProvider");
  }

  return value;
}
