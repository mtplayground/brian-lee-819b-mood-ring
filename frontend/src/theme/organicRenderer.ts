import type { CSSProperties } from "react";
import type { ThemeTokens } from "./engine";
import {
  tokensToCssVariables,
  type ThemeCssVariables,
  type ThemeRenderResult,
  type ThemeRenderer,
} from "./renderer";

type OrganicCssVariables = ThemeCssVariables & {
  "--organic-canopy-opacity": string;
  "--organic-current-opacity": string;
  "--organic-flow-duration": string;
  "--organic-light-opacity": string;
  "--organic-sway-distance": string;
  "--organic-sway-lift": string;
};

const organicCssVariables = (tokens: ThemeTokens): OrganicCssVariables => ({
  ...tokensToCssVariables(tokens),
  "--organic-canopy-opacity": (0.14 + tokens.layout.borderStrength * 0.92).toFixed(3),
  "--organic-current-opacity": (0.16 + tokens.layout.rhythm * 0.11).toFixed(3),
  "--organic-flow-duration": `${Math.round(tokens.motion.durationMs * 2.65)}ms`,
  "--organic-light-opacity": (0.2 + tokens.motion.amplitude * 0.24).toFixed(3),
  "--organic-sway-distance": `${Math.round(7 + tokens.motion.amplitude * 18)}px`,
  "--organic-sway-lift": `${Math.round(-3 - tokens.motion.amplitude * 7)}px`,
});

const organicStageStyle = (tokens: ThemeTokens): CSSProperties => ({
  transitionDuration: `${tokens.motion.durationMs}ms`,
  transitionTimingFunction: tokens.motion.easing,
});

export const organicThemeRenderer: ThemeRenderer = {
  id: "organic",
  label: "Organic & elemental",
  render(tokens): ThemeRenderResult {
    return {
      rendererId: "organic",
      rootClassName: "theme-renderer theme-renderer--organic",
      rootStyle: organicCssVariables(tokens),
      stageStyle: organicStageStyle(tokens),
    };
  },
};
