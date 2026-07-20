import type { CSSProperties } from "react";
import type { PresetMoodDefinition } from "../../types";

type IntensityBlendControlProps = {
  adjacentPreset: PresetMoodDefinition | undefined;
  selectedPreset: PresetMoodDefinition | undefined;
  value: number;
  onChange: (value: number) => void;
};

type BlendControlStyle = CSSProperties & {
  "--blend-core": string;
  "--blend-accent": string;
  "--blend-target": string;
  "--blend-position": string;
  "--dial-rotation": string;
};

const clampBlendValue = (value: number): number => Math.min(100, Math.max(0, value));

const blendSummary = (
  selectedPreset: PresetMoodDefinition | undefined,
  adjacentPreset: PresetMoodDefinition | undefined,
  value: number,
): string => {
  if (!selectedPreset) {
    return "Choose a preset to tune the feeling.";
  }

  if (value <= 50) {
    return `${selectedPreset.label} at ${Math.round((value / 50) * 100)}% intensity.`;
  }

  const blendAmount = Math.round(((value - 50) / 50) * 100);
  const targetLabel = adjacentPreset?.label ?? selectedPreset.label;

  return `${selectedPreset.label} blending ${blendAmount}% toward ${targetLabel}.`;
};

export function IntensityBlendControl({
  adjacentPreset,
  selectedPreset,
  value,
  onChange,
}: IntensityBlendControlProps) {
  const normalizedValue = clampBlendValue(value);
  const isDisabled = !selectedPreset;
  const style: BlendControlStyle = {
    "--blend-core": selectedPreset?.signature.coreColor ?? "#64748b",
    "--blend-accent": selectedPreset?.signature.accentColor ?? "#94a3b8",
    "--blend-target": adjacentPreset?.signature.coreColor ?? selectedPreset?.signature.accentColor ?? "#cbd5e1",
    "--blend-position": `${normalizedValue}%`,
    "--dial-rotation": `${-120 + normalizedValue * 2.4}deg`,
  };

  return (
    <section className="blend-control" aria-labelledby="blend-control-heading" style={style}>
      <div className="blend-control__summary">
        <h3 id="blend-control-heading">Intensity / blend</h3>
        <p>{blendSummary(selectedPreset, adjacentPreset, normalizedValue)}</p>
      </div>

      <div className="blend-control__dial" aria-hidden="true">
        <span className="blend-control__needle" />
      </div>

      <label className="blend-control__range">
        <span className="blend-control__range-label">Fine tune</span>
        <input
          aria-valuetext={blendSummary(selectedPreset, adjacentPreset, normalizedValue)}
          disabled={isDisabled}
          max="100"
          min="0"
          onChange={(event) => onChange(clampBlendValue(event.currentTarget.valueAsNumber))}
          type="range"
          value={normalizedValue}
        />
      </label>

      <div className="blend-control__scale" aria-hidden="true">
        <span>Quiet</span>
        <span>{selectedPreset?.label ?? "Preset"}</span>
        <span>{adjacentPreset?.label ?? "Next"}</span>
      </div>
    </section>
  );
}
