import { createMoodPresetId, type MoodPresetId } from "./mood";

export type PresetMoodDefinition = {
  id: MoodPresetId;
  label: string;
  shorthand: string;
  signature: MoodSignature;
};

export type MoodSignature = {
  coreColor: string;
  accentColor: string;
  ambientColor: string;
  energy: number;
  softness: number;
  clarity: number;
  motion: SignatureMotion;
  texture: SignatureTexture;
};

export type SignatureMotion = "drift" | "pulse" | "bloom" | "flicker" | "sink" | "scatter";

export type SignatureTexture = "mist" | "glass" | "velvet" | "spark" | "grain" | "static";

export const PRESET_MOODS = [
  {
    id: createMoodPresetId("still"),
    label: "Still",
    shorthand: "quiet, settled, low ripple",
    signature: {
      coreColor: "#7dd3fc",
      accentColor: "#99f6e4",
      ambientColor: "#0f172a",
      energy: 0.18,
      softness: 0.82,
      clarity: 0.72,
      motion: "drift",
      texture: "mist",
    },
  },
  {
    id: createMoodPresetId("bright"),
    label: "Bright",
    shorthand: "open, buoyant, clear edge",
    signature: {
      coreColor: "#facc15",
      accentColor: "#38bdf8",
      ambientColor: "#172554",
      energy: 0.78,
      softness: 0.38,
      clarity: 0.9,
      motion: "pulse",
      texture: "glass",
    },
  },
  {
    id: createMoodPresetId("tender"),
    label: "Tender",
    shorthand: "warm, close, soft bloom",
    signature: {
      coreColor: "#f9a8d4",
      accentColor: "#fcd34d",
      ambientColor: "#3b1d31",
      energy: 0.42,
      softness: 0.92,
      clarity: 0.52,
      motion: "bloom",
      texture: "velvet",
    },
  },
  {
    id: createMoodPresetId("charged"),
    label: "Charged",
    shorthand: "electric, eager, sharp pulse",
    signature: {
      coreColor: "#fb7185",
      accentColor: "#22d3ee",
      ambientColor: "#1e1b4b",
      energy: 0.94,
      softness: 0.22,
      clarity: 0.82,
      motion: "flicker",
      texture: "spark",
    },
  },
  {
    id: createMoodPresetId("heavy"),
    label: "Heavy",
    shorthand: "low, muted, slow weight",
    signature: {
      coreColor: "#94a3b8",
      accentColor: "#a78bfa",
      ambientColor: "#111827",
      energy: 0.16,
      softness: 0.48,
      clarity: 0.34,
      motion: "sink",
      texture: "grain",
    },
  },
  {
    id: createMoodPresetId("restless"),
    label: "Restless",
    shorthand: "jagged, searching, quick scatter",
    signature: {
      coreColor: "#fb923c",
      accentColor: "#34d399",
      ambientColor: "#312e81",
      energy: 0.86,
      softness: 0.18,
      clarity: 0.46,
      motion: "scatter",
      texture: "static",
    },
  },
] as const satisfies readonly PresetMoodDefinition[];

export const PRESET_MOOD_IDS = PRESET_MOODS.map((preset) => preset.id);

export function getPresetMood(presetId: MoodPresetId): PresetMoodDefinition | undefined {
  return PRESET_MOODS.find((preset) => preset.id === presetId);
}

export function isPresetMoodId(value: MoodPresetId): boolean {
  return PRESET_MOODS.some((preset) => preset.id === value);
}
