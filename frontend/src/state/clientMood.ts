import type { MoodValue, PresetMoodDefinition } from "../types";
import { createMoodValue } from "../types";

export type MoodBlendState = {
  adjacentPresetId: MoodValue["presetId"];
  amount: number;
};

export type ClientMoodState = {
  value: MoodValue;
  selectedPreset: PresetMoodDefinition;
  adjacentPreset?: PresetMoodDefinition;
  blend: MoodBlendState | null;
  blendDialValue: number;
  updatedAt: string;
};

type BuildClientMoodStateInput = {
  adjacentPreset: PresetMoodDefinition | undefined;
  blendDialValue: number;
  note: string;
  selectedPreset: PresetMoodDefinition | undefined;
};

const clampDialValue = (value: number): number => Math.min(100, Math.max(0, value));

export function moodIntensityFromDialValue(blendDialValue: number): number {
  const value = clampDialValue(blendDialValue);

  return value <= 50 ? value / 50 : 1;
}

export function blendAmountFromDialValue(blendDialValue: number): number {
  const value = clampDialValue(blendDialValue);

  return value <= 50 ? 0 : (value - 50) / 50;
}

export function buildClientMoodState({
  adjacentPreset,
  blendDialValue,
  note,
  selectedPreset,
}: BuildClientMoodStateInput): ClientMoodState | null {
  if (!selectedPreset) {
    return null;
  }

  const normalizedDialValue = clampDialValue(blendDialValue);
  const blendAmount = blendAmountFromDialValue(normalizedDialValue);
  const trimmedNote = note.trim();
  const value = createMoodValue({
    presetId: selectedPreset.id,
    intensity: moodIntensityFromDialValue(normalizedDialValue),
    note: trimmedNote || undefined,
  });

  return {
    value,
    selectedPreset,
    adjacentPreset,
    blend:
      adjacentPreset && blendAmount > 0
        ? {
            adjacentPresetId: adjacentPreset.id,
            amount: blendAmount,
          }
        : null,
    blendDialValue: normalizedDialValue,
    updatedAt: new Date().toISOString(),
  };
}
