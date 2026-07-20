import { useMemo, useState } from "react";
import type { MoodPresetId, PresetMoodDefinition } from "../../types";
import { getPresetMood, PRESET_MOODS } from "../../types";
import { IntensityBlendControl } from "./IntensityBlendControl";
import { NoteInput } from "./NoteInput";
import { PresetSelector } from "./PresetSelector";

const DEFAULT_BLEND_VALUE = 50;

const getAdjacentPreset = (
  selectedPreset: PresetMoodDefinition | undefined,
): PresetMoodDefinition | undefined => {
  if (!selectedPreset) {
    return undefined;
  }

  const selectedIndex = PRESET_MOODS.findIndex((preset) => preset.id === selectedPreset.id);
  const adjacentIndex = selectedIndex >= 0 ? (selectedIndex + 1) % PRESET_MOODS.length : 0;

  return PRESET_MOODS[adjacentIndex];
};

export function MoodInputPanel() {
  const [selectedPresetId, setSelectedPresetId] = useState<MoodPresetId | null>(null);
  const [blendValue, setBlendValue] = useState(DEFAULT_BLEND_VALUE);
  const [note, setNote] = useState("");
  const selectedPreset = useMemo(
    () => (selectedPresetId ? getPresetMood(selectedPresetId) : undefined),
    [selectedPresetId],
  );
  const adjacentPreset = useMemo(() => getAdjacentPreset(selectedPreset), [selectedPreset]);

  const handleSelectPreset = (preset: PresetMoodDefinition) => {
    setSelectedPresetId(preset.id);
    setBlendValue(DEFAULT_BLEND_VALUE);
  };

  return (
    <section className="mood-input" aria-labelledby="mood-input-heading">
      <div className="mood-input__header">
        <p className="route-panel__eyebrow">Mood input</p>
        <h2 id="mood-input-heading">Pick the closest starting point.</h2>
      </div>

      <PresetSelector selectedPresetId={selectedPresetId} onSelect={handleSelectPreset} />

      <IntensityBlendControl
        adjacentPreset={adjacentPreset}
        selectedPreset={selectedPreset}
        onChange={setBlendValue}
        value={blendValue}
      />

      <NoteInput value={note} onChange={setNote} />

      <p className="mood-input__selection" role="status">
        {selectedPreset
          ? `${selectedPreset.label}: ${selectedPreset.shorthand}.${note.trim() ? " Note added." : ""}`
          : "No mood selected yet."}
      </p>
    </section>
  );
}
