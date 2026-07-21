import type { CSSProperties } from "react";
import type { ThemeTokens } from "./engine";
import {
  tokensToCssVariables,
  type ThemeCssVariables,
  type ThemeRenderResult,
  type ThemeRenderer,
} from "./renderer";

type RetroCssVariables = ThemeCssVariables & {
  "--retro-bezel-width": string;
  "--retro-grain-opacity": string;
  "--retro-needle-rotation": string;
  "--retro-panel-depth": string;
  "--retro-sweep-duration": string;
  "--retro-tick-opacity": string;
  "--retro-warm-wash": string;
  "--retro-warm-wash-percent": string;
};

const retroCssVariables = (tokens: ThemeTokens): RetroCssVariables => ({
  ...tokensToCssVariables(tokens),
  "--retro-bezel-width": `${Math.round(10 + tokens.layout.borderStrength * 42)}px`,
  "--retro-grain-opacity": (0.1 + tokens.layout.borderStrength * 0.54).toFixed(3),
  "--retro-needle-rotation": `${Math.round(-58 + tokens.motion.amplitude * 116)}deg`,
  "--retro-panel-depth": `${Math.round(18 + tokens.motion.amplitude * 18)}px`,
  "--retro-sweep-duration": `${Math.round(tokens.motion.durationMs * 1.9)}ms`,
  "--retro-tick-opacity": (0.24 + tokens.motion.amplitude * 0.34).toFixed(3),
  "--retro-warm-wash": (0.18 + tokens.layout.rhythm * 0.12).toFixed(3),
  "--retro-warm-wash-percent": `${Math.round((0.18 + tokens.layout.rhythm * 0.12) * 100)}%`,
});

const retroStageStyle = (tokens: ThemeTokens): CSSProperties => ({
  transitionDuration: `${tokens.motion.durationMs}ms`,
  transitionTimingFunction: tokens.motion.easing,
});

export const retroThemeRenderer: ThemeRenderer = {
  id: "retro",
  label: "Retro analog",
  render(tokens): ThemeRenderResult {
    return {
      rendererId: "retro",
      rootClassName: "theme-renderer theme-renderer--retro",
      rootStyle: retroCssVariables(tokens),
      stageStyle: retroStageStyle(tokens),
    };
  },
};
