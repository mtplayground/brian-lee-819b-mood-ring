export type {
  MoodIntensity,
  MoodNote,
  MoodPresetId,
  MoodValue,
} from "./mood";
export type {
  MoodSignature,
  PresetMoodDefinition,
  SignatureMotion,
  SignatureTexture,
} from "./presetMood";

export {
  MAX_MOOD_NOTE_LENGTH,
  MAX_MOOD_PRESET_ID_LENGTH,
  createMoodIntensity,
  createMoodNote,
  createMoodPresetId,
  createMoodValue,
  isMoodValue,
} from "./mood";
export {
  PRESET_MOOD_IDS,
  PRESET_MOODS,
  getPresetMood,
  isPresetMoodId,
} from "./presetMood";
