import type { CSSProperties } from "react";
import type { ThemeTokens } from "./engine";
import {
  tokensToCssVariables,
  type ThemeCssVariables,
  type ThemeRenderResult,
  type ThemeRenderer,
} from "./renderer";

type PainterlyCssVariables = ThemeCssVariables & {
  "--painterly-blur": string;
  "--painterly-drift-duration": string;
  "--painterly-drift-x": string;
  "--painterly-drift-x-negative": string;
  "--painterly-saturation": string;
  "--painterly-stroke-opacity": string;
  "--painterly-wash-opacity": string;
};

const painterlyCssVariables = (tokens: ThemeTokens): PainterlyCssVariables => ({
  ...tokensToCssVariables(tokens),
  "--painterly-blur": `${Math.round(18 + tokens.motion.amplitude * 18)}px`,
  "--painterly-drift-duration": `${Math.round(tokens.motion.durationMs * 2.35)}ms`,
  "--painterly-drift-x": `${Math.round(10 + tokens.motion.amplitude * 24)}px`,
  "--painterly-drift-x-negative": `${Math.round(-10 - tokens.motion.amplitude * 24)}px`,
  "--painterly-saturation": (1.05 + tokens.motion.amplitude * 0.24).toFixed(3),
  "--painterly-stroke-opacity": (0.28 + tokens.layout.borderStrength * 1.1).toFixed(3),
  "--painterly-wash-opacity": (0.42 + tokens.layout.rhythm * 0.14).toFixed(3),
});

const painterlyStageStyle = (tokens: ThemeTokens): CSSProperties => ({
  transitionDuration: `${tokens.motion.durationMs}ms`,
  transitionTimingFunction: tokens.motion.easing,
});

export const painterlyThemeRenderer: ThemeRenderer = {
  id: "painterly",
  label: "Painterly & abstract",
  render(tokens): ThemeRenderResult {
    return {
      rendererId: "painterly",
      rootClassName: "theme-renderer theme-renderer--painterly",
      rootStyle: painterlyCssVariables(tokens),
      stageStyle: painterlyStageStyle(tokens),
    };
  },
};
