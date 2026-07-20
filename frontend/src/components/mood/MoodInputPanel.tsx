import { useMemo, useState } from "react";
import type { MoodPresetId, PresetMoodDefinition } from "../../types";
import { getPresetMood } from "../../types";
import { PresetSelector } from "./PresetSelector";

export function MoodInputPanel() {
  const [selectedPresetId, setSelectedPresetId] = useState<MoodPresetId | null>(null);
  const selectedPreset = useMemo(
    () => (selectedPresetId ? getPresetMood(selectedPresetId) : undefined),
    [selectedPresetId],
  );

  const handleSelectPreset = (preset: PresetMoodDefinition) => {
    setSelectedPresetId(preset.id);
  };

  return (
    <section className="mood-input" aria-labelledby="mood-input-heading">
      <div className="mood-input__header">
        <p className="route-panel__eyebrow">Mood input</p>
        <h2 id="mood-input-heading">Pick the closest starting point.</h2>
      </div>

      <PresetSelector selectedPresetId={selectedPresetId} onSelect={handleSelectPreset} />

      <p className="mood-input__selection" role="status">
        {selectedPreset
          ? `${selectedPreset.label}: ${selectedPreset.shorthand}.`
          : "No mood selected yet."}
      </p>
    </section>
  );
}
