import { useEffect } from "react";
import { updateThemePreference } from "../../api/rooms";
import { creativeThemeChoices, type CreativeThemeId } from "../../theme";
import { useAppState } from "../../state/AppStateContext";
import { storeRoomIdentity } from "../../state/roomIdentity";

const nextThemeId = (activeThemeId: CreativeThemeId): CreativeThemeId => {
  const activeIndex = creativeThemeChoices.findIndex((choice) => choice.id === activeThemeId);
  const nextIndex = activeIndex >= 0 ? (activeIndex + 1) % creativeThemeChoices.length : 0;

  return creativeThemeChoices[nextIndex].id;
};

export function ThemeSelector() {
  const { activeRoomIdentity, activeThemeId, config, setActiveRoomIdentity, setActiveThemeId } =
    useAppState();

  useEffect(() => {
    if (!activeRoomIdentity || activeRoomIdentity.lastUsedThemeId === activeThemeId) {
      return undefined;
    }

    let cancelled = false;

    updateThemePreference(config, activeRoomIdentity.roomId, activeRoomIdentity, activeThemeId)
      .then((preference) => {
        if (cancelled) {
          return;
        }

        const nextIdentity = {
          ...activeRoomIdentity,
          lastUsedThemeId: preference.themeId,
        };
        storeRoomIdentity(nextIdentity.roomId, nextIdentity);
        setActiveRoomIdentity(nextIdentity);
      })
      .catch((error: unknown) => {
        console.warn("Unable to save theme preference", error);
      });

    return () => {
      cancelled = true;
    };
  }, [activeRoomIdentity, activeThemeId, config, setActiveRoomIdentity]);

  return (
    <div className="theme-selector" aria-label="Creative lens">
      <div className="theme-selector__options" role="group" aria-label="Theme">
        {creativeThemeChoices.map((choice) => (
          <button
            aria-pressed={activeThemeId === choice.id}
            className="theme-selector__option"
            key={choice.id}
            onClick={() => setActiveThemeId(choice.id)}
            type="button"
          >
            <span
              aria-hidden="true"
              className={`theme-selector__swatch theme-selector__swatch--${choice.id}`}
            />
            <span>{choice.label}</span>
          </button>
        ))}
      </div>

      <button
        className="theme-selector__cycle"
        onClick={() => setActiveThemeId(nextThemeId(activeThemeId))}
        type="button"
      >
        Next
      </button>
    </div>
  );
}
