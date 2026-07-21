import { creativeThemeChoices, type CreativeThemeId } from "../../theme";
import { useAppState } from "../../state/AppStateContext";

const nextThemeId = (activeThemeId: CreativeThemeId): CreativeThemeId => {
  const activeIndex = creativeThemeChoices.findIndex((choice) => choice.id === activeThemeId);
  const nextIndex = activeIndex >= 0 ? (activeIndex + 1) % creativeThemeChoices.length : 0;

  return creativeThemeChoices[nextIndex].id;
};

export function ThemeSelector() {
  const { activeThemeId, setActiveThemeId } = useAppState();

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
