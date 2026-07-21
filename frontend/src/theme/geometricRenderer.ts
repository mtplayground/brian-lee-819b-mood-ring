import type { CSSProperties } from "react";
import type { ThemeTokens } from "./engine";
import {
  tokensToCssVariables,
  type ThemeCssVariables,
  type ThemeRenderResult,
  type ThemeRenderer,
} from "./renderer";

type GeometricCssVariables = ThemeCssVariables & {
  "--geometric-block-size": string;
  "--geometric-field-offset": string;
  "--geometric-field-offset-negative": string;
  "--geometric-gap": string;
  "--geometric-grid-opacity": string;
  "--geometric-sweep-duration": string;
  "--geometric-type-weight": string;
  "--geometric-word-spacing": string;
};

const geometricCssVariables = (tokens: ThemeTokens): GeometricCssVariables => ({
  ...tokensToCssVariables(tokens),
  "--geometric-block-size": `${Math.round(72 + tokens.motion.amplitude * 96)}px`,
  "--geometric-field-offset": `${Math.round(10 + tokens.motion.amplitude * 28)}px`,
  "--geometric-field-offset-negative": `${Math.round(-10 - tokens.motion.amplitude * 28)}px`,
  "--geometric-gap": `${Math.round(14 + tokens.layout.rhythm * 14)}px`,
  "--geometric-grid-opacity": (0.12 + tokens.layout.borderStrength * 0.84).toFixed(3),
  "--geometric-sweep-duration": `${Math.round(tokens.motion.durationMs * 1.85)}ms`,
  "--geometric-type-weight": String(Math.round(tokens.typography.headingWeight + tokens.motion.amplitude * 70)),
  "--geometric-word-spacing": `${(0.02 + tokens.motion.amplitude * 0.08).toFixed(3)}em`,
});

const geometricStageStyle = (tokens: ThemeTokens): CSSProperties => ({
  transitionDuration: `${tokens.motion.durationMs}ms`,
  transitionTimingFunction: tokens.motion.easing,
});

export const geometricThemeRenderer: ThemeRenderer = {
  id: "geometric",
  label: "Minimal geometric & typographic",
  render(tokens): ThemeRenderResult {
    return {
      rendererId: "geometric",
      rootClassName: "theme-renderer theme-renderer--geometric",
      rootStyle: geometricCssVariables(tokens),
      stageStyle: geometricStageStyle(tokens),
    };
  },
};
