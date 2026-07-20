export const MAX_MOOD_PRESET_ID_LENGTH = 64;
export const MAX_MOOD_NOTE_LENGTH = 160;

declare const moodPresetIdBrand: unique symbol;
declare const moodIntensityBrand: unique symbol;
declare const moodNoteBrand: unique symbol;

export type MoodPresetId = string & {
  readonly [moodPresetIdBrand]: "MoodPresetId";
};

export type MoodIntensity = number & {
  readonly [moodIntensityBrand]: "MoodIntensity";
};

export type MoodNote = string & {
  readonly [moodNoteBrand]: "MoodNote";
};

export type MoodValue = {
  presetId: MoodPresetId;
  intensity: MoodIntensity;
  note?: MoodNote;
};

export function createMoodPresetId(value: string): MoodPresetId {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error("Mood preset id cannot be empty");
  }

  if (normalized.length > MAX_MOOD_PRESET_ID_LENGTH) {
    throw new Error(`Mood preset id must be at most ${MAX_MOOD_PRESET_ID_LENGTH} bytes`);
  }

  if (!/^[A-Za-z0-9_-]+$/.test(normalized)) {
    throw new Error(
      "Mood preset id can only contain ASCII letters, numbers, hyphens, and underscores",
    );
  }

  return normalized as MoodPresetId;
}

export function createMoodIntensity(value: number): MoodIntensity {
  if (!Number.isFinite(value)) {
    throw new Error("Mood intensity must be a finite number");
  }

  if (value < 0 || value > 1) {
    throw new Error("Mood intensity must be between 0 and 1");
  }

  return value as MoodIntensity;
}

export function createMoodNote(value: string): MoodNote {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error("Mood note cannot be empty");
  }

  if ([...normalized].length > MAX_MOOD_NOTE_LENGTH) {
    throw new Error(`Mood note must be at most ${MAX_MOOD_NOTE_LENGTH} characters`);
  }

  return normalized as MoodNote;
}

export function createMoodValue(input: {
  presetId: string;
  intensity: number;
  note?: string | null;
}): MoodValue {
  const note = input.note?.trim() ? createMoodNote(input.note) : undefined;

  return {
    presetId: createMoodPresetId(input.presetId),
    intensity: createMoodIntensity(input.intensity),
    ...(note ? { note } : {}),
  };
}

export function isMoodValue(value: unknown): value is MoodValue {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<Record<keyof MoodValue, unknown>>;

  try {
    createMoodValue({
      presetId: typeof candidate.presetId === "string" ? candidate.presetId : "",
      intensity: typeof candidate.intensity === "number" ? candidate.intensity : Number.NaN,
      note: typeof candidate.note === "string" ? candidate.note : undefined,
    });
    return true;
  } catch {
    return false;
  }
}
