import type { CSSProperties } from "react";
import type { ClientMoodState } from "../state/clientMood";
import type { ThemeTokens } from "./engine";

export type ThemeCssVariables = CSSProperties & {
  "--theme-accent": string;
  "--theme-bg-end": string;
  "--theme-bg-mid": string;
  "--theme-bg-start": string;
  "--theme-border-strength": string;
  "--theme-core": string;
  "--theme-easing": string;
  "--theme-heading-scale": string;
  "--theme-heading-max": string;
  "--theme-heading-min": string;
  "--theme-heading-weight": string;
  "--theme-main-padding-block": string;
  "--theme-glow-size": string;
  "--theme-motion-amplitude": string;
  "--theme-motion-duration": string;
  "--theme-muted-text": string;
  "--theme-panel-padding": string;
  "--theme-panel-padding-scale": string;
  "--theme-panel-shadow-y": string;
  "--theme-rhythm": string;
  "--theme-stage-accent": string;
  "--theme-stage-core": string;
  "--theme-stage-glow": string;
  "--theme-surface": string;
  "--theme-text": string;
};

export type ThemeRenderResult = {
  rendererId: string;
  rootClassName: string;
  rootStyle: ThemeCssVariables;
  stageStyle: CSSProperties;
};

export type ThemeRenderer = {
  id: string;
  label: string;
  render: (tokens: ThemeTokens, mood: ClientMoodState | null) => ThemeRenderResult;
};

const tokensToCssVariables = (tokens: ThemeTokens): ThemeCssVariables => ({
  "--theme-accent": tokens.palette.accent,
  "--theme-bg-end": tokens.palette.backgroundEnd,
  "--theme-bg-mid": tokens.palette.backgroundMid,
  "--theme-bg-start": tokens.palette.backgroundStart,
  "--theme-border-strength": tokens.layout.borderStrength.toFixed(3),
  "--theme-core": tokens.palette.core,
  "--theme-easing": tokens.motion.easing,
  "--theme-heading-max": `${4.5 * tokens.typography.headingScale}rem`,
  "--theme-heading-min": `${2.25 * tokens.typography.headingScale}rem`,
  "--theme-heading-scale": tokens.typography.headingScale.toFixed(3),
  "--theme-heading-weight": String(tokens.typography.headingWeight),
  "--theme-glow-size": `${18 + tokens.motion.amplitude * 18}px`,
  "--theme-main-padding-block": `${2 + tokens.layout.rhythm * 1.2}rem`,
  "--theme-motion-amplitude": tokens.motion.amplitude.toFixed(3),
  "--theme-motion-duration": `${tokens.motion.durationMs}ms`,
  "--theme-muted-text": tokens.palette.mutedText,
  "--theme-panel-padding": `${1.5 * tokens.layout.panelPaddingScale}rem`,
  "--theme-panel-padding-scale": tokens.layout.panelPaddingScale.toFixed(3),
  "--theme-panel-shadow-y": `${18 + tokens.motion.amplitude * 16}px`,
  "--theme-rhythm": tokens.layout.rhythm.toFixed(3),
  "--theme-stage-accent": tokens.palette.stageAccent,
  "--theme-stage-core": tokens.palette.stageCore,
  "--theme-stage-glow": tokens.palette.stageGlow,
  "--theme-surface": tokens.palette.surface,
  "--theme-text": tokens.palette.text,
});

export const baseThemeRenderer: ThemeRenderer = {
  id: "base",
  label: "Base mood renderer",
  render(tokens) {
    return {
      rendererId: "base",
      rootClassName: "theme-renderer theme-renderer--base",
      rootStyle: tokensToCssVariables(tokens),
      stageStyle: {
        transitionDuration: `${tokens.motion.durationMs}ms`,
        transitionTimingFunction: tokens.motion.easing,
      },
    };
  },
};
