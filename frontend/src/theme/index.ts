import { geometricThemeRenderer } from "./geometricRenderer";
import { organicThemeRenderer } from "./organicRenderer";
import { painterlyThemeRenderer } from "./painterlyRenderer";
import { retroThemeRenderer } from "./retroRenderer";
import type { ThemeRenderer } from "./renderer";

export type {
  ThemeLayoutTokens,
  ThemeMotionTokens,
  ThemePaletteTokens,
  ThemeTokens,
  ThemeTypographyTokens,
} from "./engine";
export { moodToThemeTokens } from "./engine";
export type {
  ThemeCssVariables,
  ThemeRenderer,
  ThemeRenderResult,
} from "./renderer";
export { baseThemeRenderer } from "./renderer";
export { geometricThemeRenderer } from "./geometricRenderer";
export { organicThemeRenderer } from "./organicRenderer";
export { painterlyThemeRenderer } from "./painterlyRenderer";
export { retroThemeRenderer } from "./retroRenderer";

export type CreativeThemeId = "organic" | "geometric" | "painterly" | "retro";

export type CreativeThemeChoice = {
  id: CreativeThemeId;
  label: string;
  renderer: ThemeRenderer;
};

export const creativeThemeChoices: CreativeThemeChoice[] = [
  { id: "organic", label: "Organic", renderer: organicThemeRenderer },
  { id: "geometric", label: "Geometric", renderer: geometricThemeRenderer },
  { id: "painterly", label: "Painterly", renderer: painterlyThemeRenderer },
  { id: "retro", label: "Retro", renderer: retroThemeRenderer },
];

export const themeRendererById: Record<CreativeThemeId, ThemeRenderer> = {
  organic: organicThemeRenderer,
  geometric: geometricThemeRenderer,
  painterly: painterlyThemeRenderer,
  retro: retroThemeRenderer,
};
