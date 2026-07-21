import { createContext, useContext, useMemo, useState, type PropsWithChildren } from "react";
import type { ClientConfig } from "../api/config";
import type { CreativeThemeId } from "../theme";
import type { ClientMoodState } from "./clientMood";

export type AppThemeMode = "system" | "light" | "dark";

export type AppState = {
  activeThemeId: CreativeThemeId;
  config: ClientConfig;
  currentMood: ClientMoodState | null;
  setActiveThemeId: (themeId: CreativeThemeId) => void;
  setCurrentMood: (currentMood: ClientMoodState | null) => void;
  themeMode: AppThemeMode;
  setThemeMode: (themeMode: AppThemeMode) => void;
};

const AppStateContext = createContext<AppState | null>(null);

type AppStateProviderProps = PropsWithChildren<{
  config: ClientConfig;
}>;

export function AppStateProvider({ children, config }: AppStateProviderProps) {
  const [activeThemeId, setActiveThemeId] = useState<CreativeThemeId>("retro");
  const [currentMood, setCurrentMood] = useState<ClientMoodState | null>(null);
  const [themeMode, setThemeMode] = useState<AppThemeMode>("system");

  const value = useMemo<AppState>(
    () => ({
      activeThemeId,
      config,
      currentMood,
      setActiveThemeId,
      setCurrentMood,
      themeMode,
      setThemeMode,
    }),
    [activeThemeId, config, currentMood, themeMode],
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
