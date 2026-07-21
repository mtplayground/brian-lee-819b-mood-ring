import { createContext, useContext, useMemo, useState, type PropsWithChildren } from "react";
import type { ClientConfig } from "../api/config";
import type { CreativeThemeId } from "../theme";
import type { ClientMoodState } from "./clientMood";
import type { StoredRoomIdentity } from "./roomIdentity";

export type RemoteParticipantMood = {
  participantId: string;
  slot: StoredRoomIdentity["slot"];
  mood: ClientMoodState;
  receivedAt: string;
};

export type AppThemeMode = "system" | "light" | "dark";

export type AppState = {
  activeThemeId: CreativeThemeId;
  activeRoomIdentity: StoredRoomIdentity | null;
  config: ClientConfig;
  currentMood: ClientMoodState | null;
  remoteMood: RemoteParticipantMood | null;
  setActiveRoomIdentity: (identity: StoredRoomIdentity | null) => void;
  setActiveThemeId: (themeId: CreativeThemeId) => void;
  setCurrentMood: (currentMood: ClientMoodState | null) => void;
  setRemoteMood: (remoteMood: RemoteParticipantMood | null) => void;
  themeMode: AppThemeMode;
  setThemeMode: (themeMode: AppThemeMode) => void;
};

const AppStateContext = createContext<AppState | null>(null);

type AppStateProviderProps = PropsWithChildren<{
  config: ClientConfig;
}>;

export function AppStateProvider({ children, config }: AppStateProviderProps) {
  const [activeRoomIdentity, setActiveRoomIdentity] = useState<StoredRoomIdentity | null>(null);
  const [activeThemeId, setActiveThemeId] = useState<CreativeThemeId>("retro");
  const [currentMood, setCurrentMood] = useState<ClientMoodState | null>(null);
  const [remoteMood, setRemoteMood] = useState<RemoteParticipantMood | null>(null);
  const [themeMode, setThemeMode] = useState<AppThemeMode>("system");

  const value = useMemo<AppState>(
    () => ({
      activeThemeId,
      activeRoomIdentity,
      config,
      currentMood,
      remoteMood,
      setActiveRoomIdentity,
      setActiveThemeId,
      setCurrentMood,
      setRemoteMood,
      themeMode,
      setThemeMode,
    }),
    [activeRoomIdentity, activeThemeId, config, currentMood, remoteMood, themeMode],
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
