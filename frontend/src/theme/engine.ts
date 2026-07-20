import type { ClientMoodState } from "../state/clientMood";
import type { MoodSignature } from "../types";

export type ThemePaletteTokens = {
  accent: string;
  ambient: string;
  backgroundEnd: string;
  backgroundMid: string;
  backgroundStart: string;
  core: string;
  mutedText: string;
  stageAccent: string;
  stageCore: string;
  stageGlow: string;
  surface: string;
  text: string;
};

export type ThemeTypographyTokens = {
  bodyWeight: number;
  headingScale: number;
  headingWeight: number;
  letterSpacing: 0;
};

export type ThemeMotionTokens = {
  amplitude: number;
  durationMs: number;
  easing: string;
};

export type ThemeLayoutTokens = {
  borderStrength: number;
  panelPaddingScale: number;
  rhythm: number;
};

export type ThemeTokens = {
  layout: ThemeLayoutTokens;
  motion: ThemeMotionTokens;
  palette: ThemePaletteTokens;
  typography: ThemeTypographyTokens;
};

const DEFAULT_TOKENS: ThemeTokens = {
  palette: {
    accent: "#5eead4",
    ambient: "#111827",
    backgroundEnd: "#3f2b5f",
    backgroundMid: "#1f2937",
    backgroundStart: "#111827",
    core: "#2dd4bf",
    mutedText: "rgba(248, 250, 252, 0.74)",
    stageAccent: "rgba(251, 191, 36, 0.2)",
    stageCore: "rgba(45, 212, 191, 0.38)",
    stageGlow: "rgba(244, 114, 182, 0.26)",
    surface: "rgba(17, 24, 39, 0.68)",
    text: "#f8fafc",
  },
  typography: {
    bodyWeight: 500,
    headingScale: 1,
    headingWeight: 800,
    letterSpacing: 0,
  },
  motion: {
    amplitude: 0.36,
    durationMs: 760,
    easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  },
  layout: {
    borderStrength: 0.18,
    panelPaddingScale: 1,
    rhythm: 1,
  },
};

type Rgb = {
  b: number;
  g: number;
  r: number;
};

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));

const parseHexColor = (hexColor: string): Rgb => {
  const normalized = hexColor.replace("#", "");
  const value = normalized.length === 3
    ? normalized.split("").map((part) => part + part).join("")
    : normalized;

  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
};

const toHex = (value: number): string => Math.round(value).toString(16).padStart(2, "0");

const rgbToHex = ({ r, g, b }: Rgb): string => `#${toHex(r)}${toHex(g)}${toHex(b)}`;

const mixHexColors = (from: string, to: string, amount: number): string => {
  const fromRgb = parseHexColor(from);
  const toRgb = parseHexColor(to);
  const weight = clamp(amount);

  return rgbToHex({
    r: fromRgb.r + (toRgb.r - fromRgb.r) * weight,
    g: fromRgb.g + (toRgb.g - fromRgb.g) * weight,
    b: fromRgb.b + (toRgb.b - fromRgb.b) * weight,
  });
};

const rgbaFromHex = (hexColor: string, alpha: number): string => {
  const { r, g, b } = parseHexColor(hexColor);

  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha)})`;
};

const blendSignature = (
  selected: MoodSignature,
  adjacent: MoodSignature | undefined,
  amount: number,
): MoodSignature => {
  if (!adjacent || amount <= 0) {
    return selected;
  }

  return {
    coreColor: mixHexColors(selected.coreColor, adjacent.coreColor, amount),
    accentColor: mixHexColors(selected.accentColor, adjacent.accentColor, amount),
    ambientColor: mixHexColors(selected.ambientColor, adjacent.ambientColor, amount),
    energy: selected.energy + (adjacent.energy - selected.energy) * amount,
    softness: selected.softness + (adjacent.softness - selected.softness) * amount,
    clarity: selected.clarity + (adjacent.clarity - selected.clarity) * amount,
    motion: selected.motion,
    texture: selected.texture,
  };
};

export function moodToThemeTokens(currentMood: ClientMoodState | null): ThemeTokens {
  if (!currentMood) {
    return DEFAULT_TOKENS;
  }

  const intensity = currentMood.value.intensity;
  const blendAmount = currentMood.blend?.amount ?? 0;
  const signature = blendSignature(
    currentMood.selectedPreset.signature,
    currentMood.adjacentPreset?.signature,
    blendAmount,
  );
  const energy = clamp(signature.energy * (0.48 + intensity * 0.52));
  const softness = clamp(signature.softness);
  const clarity = clamp(signature.clarity);
  const core = signature.coreColor;
  const accent = signature.accentColor;
  const ambient = signature.ambientColor;
  const backgroundStart = mixHexColors("#111827", ambient, 0.72);
  const backgroundMid = mixHexColors(ambient, core, 0.18 + energy * 0.18);
  const backgroundEnd = mixHexColors(ambient, accent, 0.2 + softness * 0.24);

  return {
    palette: {
      accent,
      ambient,
      backgroundEnd,
      backgroundMid,
      backgroundStart,
      core,
      mutedText: rgbaFromHex("#f8fafc", 0.58 + clarity * 0.28),
      stageAccent: rgbaFromHex(accent, 0.18 + energy * 0.18),
      stageCore: rgbaFromHex(core, 0.26 + intensity * 0.2),
      stageGlow: rgbaFromHex(mixHexColors(core, accent, 0.5), 0.14 + softness * 0.18),
      surface: rgbaFromHex(mixHexColors("#0f172a", ambient, 0.46), 0.62 + softness * 0.16),
      text: clarity > 0.42 ? "#f8fafc" : "#e5e7eb",
    },
    typography: {
      bodyWeight: Math.round(460 + clarity * 130),
      headingScale: 0.96 + energy * 0.08,
      headingWeight: Math.round(740 + clarity * 120),
      letterSpacing: 0,
    },
    motion: {
      amplitude: 0.18 + energy * 0.68,
      durationMs: Math.round(980 - energy * 560),
      easing: softness > 0.62 ? "cubic-bezier(0.22, 1, 0.36, 1)" : "cubic-bezier(0.76, 0, 0.24, 1)",
    },
    layout: {
      borderStrength: 0.14 + clarity * 0.16,
      panelPaddingScale: 0.94 + softness * 0.12,
      rhythm: 1.08 - energy * 0.18,
    },
  };
}
