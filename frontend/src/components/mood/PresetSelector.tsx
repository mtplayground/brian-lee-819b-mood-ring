import type { CSSProperties } from "react";
import type { MoodPresetId, PresetMoodDefinition } from "../../types";
import { PRESET_MOODS } from "../../types";

type PresetSelectorProps = {
  selectedPresetId: MoodPresetId | null;
  onSelect: (preset: PresetMoodDefinition) => void;
};

type PresetButtonStyle = CSSProperties & {
  "--preset-core": string;
  "--preset-accent": string;
  "--preset-ambient": string;
};

export function PresetSelector({ selectedPresetId, onSelect }: PresetSelectorProps) {
  return (
    <div className="preset-selector" role="listbox" aria-label="Mood presets">
      {PRESET_MOODS.map((preset) => {
        const isSelected = preset.id === selectedPresetId;
        const style: PresetButtonStyle = {
          "--preset-core": preset.signature.coreColor,
          "--preset-accent": preset.signature.accentColor,
          "--preset-ambient": preset.signature.ambientColor,
        };

        return (
          <button
            aria-selected={isSelected}
            className="preset-selector__option"
            key={preset.id}
            onClick={() => onSelect(preset)}
            role="option"
            style={style}
            type="button"
          >
            <span className="preset-selector__swatch" aria-hidden="true" />
            <span className="preset-selector__copy">
              <span className="preset-selector__label">{preset.label}</span>
              <span className="preset-selector__shorthand">{preset.shorthand}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
