import type { CSSProperties } from "react";
import type { ClientMoodState } from "../../state/clientMood";
import type { CreativeThemeId } from "../../theme";
import { moodToThemeTokens } from "../../theme";

type SharedMoodCanvasProps = {
  activeThemeId: CreativeThemeId;
  localMood: ClientMoodState | null;
  remoteMood: ClientMoodState | null;
};

type SharedMoodCanvasStyle = CSSProperties & {
  "--canvas-blend": string;
  "--canvas-duration": string;
  "--canvas-geometric-duration": string;
  "--canvas-local-accent": string;
  "--canvas-local-core": string;
  "--canvas-local-field-opacity": string;
  "--canvas-local-intensity": string;
  "--canvas-local-weight": string;
  "--canvas-local-stage": string;
  "--canvas-local-shift": string;
  "--canvas-bridge-blur": string;
  "--canvas-bridge-opacity": string;
  "--canvas-bridge-weight": string;
  "--canvas-motion": string;
  "--canvas-organic-current-duration": string;
  "--canvas-organic-sway-duration": string;
  "--canvas-painterly-blur": string;
  "--canvas-painterly-duration": string;
  "--canvas-pulse-duration": string;
  "--canvas-pulse-scale": string;
  "--canvas-retro-duration": string;
  "--canvas-remote-accent": string;
  "--canvas-remote-core": string;
  "--canvas-remote-intensity": string;
  "--canvas-remote-opacity": string;
  "--canvas-remote-stage": string;
  "--canvas-remote-shift": string;
  "--canvas-remote-weight": string;
  "--canvas-ring-opacity": string;
};

const percent = (value: number): string => `${Math.round(value * 100)}%`;

export function SharedMoodCanvas({
  activeThemeId,
  localMood,
  remoteMood,
}: SharedMoodCanvasProps) {
  const localTokens = moodToThemeTokens(localMood);
  const remoteTokens = moodToThemeTokens(remoteMood);
  const hasRemoteMood = Boolean(remoteMood);
  const localIntensity = localMood?.value.intensity ?? 0;
  const remoteIntensity = remoteMood?.value.intensity ?? 0;
  const averageMotion = (localTokens.motion.amplitude + remoteTokens.motion.amplitude) / 2;
  const averageDuration = Math.round(
    (localTokens.motion.durationMs + remoteTokens.motion.durationMs) / 2,
  );
  const canvasStyle: SharedMoodCanvasStyle = {
    "--canvas-blend": hasRemoteMood ? "1" : "0",
    "--canvas-duration": `${averageDuration}ms`,
    "--canvas-geometric-duration": `${Math.round(averageDuration * 1.8)}ms`,
    "--canvas-local-accent": localTokens.palette.accent,
    "--canvas-local-core": localTokens.palette.core,
    "--canvas-local-field-opacity": (0.68 + averageMotion * 0.24).toFixed(3),
    "--canvas-local-intensity": localIntensity.toFixed(3),
    "--canvas-local-weight": `${Math.round(34 + localIntensity * 36)}%`,
    "--canvas-local-stage": localTokens.palette.stageCore,
    "--canvas-local-shift": `${Math.round(averageMotion * -10)}px`,
    "--canvas-bridge-blur": `${Math.round(8 + averageMotion * 10)}px`,
    "--canvas-bridge-opacity": (0.36 + (hasRemoteMood ? 0.4 : 0)).toFixed(3),
    "--canvas-bridge-weight": `${hasRemoteMood ? 62 : 0}%`,
    "--canvas-motion": averageMotion.toFixed(3),
    "--canvas-organic-current-duration": `${Math.round(averageDuration * 3.1)}ms`,
    "--canvas-organic-sway-duration": `${Math.round(averageDuration * 3.4)}ms`,
    "--canvas-painterly-blur": `${Math.round(18 + averageMotion * 10)}px`,
    "--canvas-painterly-duration": `${Math.round(averageDuration * 3.2)}ms`,
    "--canvas-pulse-duration": `${Math.round(averageDuration * 2.8)}ms`,
    "--canvas-pulse-scale": (1 + averageMotion * 0.08).toFixed(3),
    "--canvas-retro-duration": `${Math.round(averageDuration * 1.4)}ms`,
    "--canvas-remote-accent": remoteTokens.palette.accent,
    "--canvas-remote-core": remoteTokens.palette.core,
    "--canvas-remote-intensity": remoteIntensity.toFixed(3),
    "--canvas-remote-opacity": (hasRemoteMood ? 0.62 + averageMotion * 0.26 : 0).toFixed(3),
    "--canvas-remote-stage": remoteTokens.palette.stageCore,
    "--canvas-remote-shift": `${Math.round(averageMotion * 10)}px`,
    "--canvas-remote-weight": `${hasRemoteMood ? Math.round(22 + remoteIntensity * 38) : 0}%`,
    "--canvas-ring-opacity": (0.26 + (hasRemoteMood ? 0.24 : 0)).toFixed(3),
  };
  const localLabel = localMood?.selectedPreset.label ?? "Choose a mood";
  const remoteLabel = remoteMood?.selectedPreset.label ?? "Waiting";

  return (
    <section
      className={`shared-canvas shared-canvas--${activeThemeId}`}
      aria-labelledby="shared-canvas-heading"
      style={canvasStyle}
    >
      <div className="shared-canvas__header">
        <p className="route-panel__eyebrow">Shared canvas</p>
        <h2 id="shared-canvas-heading">Together in motion</h2>
      </div>

      <div className="shared-canvas__stage" aria-hidden="true">
        <div className="shared-canvas__field shared-canvas__field--local" />
        <div className="shared-canvas__field shared-canvas__field--remote" />
        <div className="shared-canvas__bridge" />
        <div className="shared-canvas__pulse" />
      </div>

      <div className="shared-canvas__readout" aria-label="Canvas mood blend">
        <div>
          <span>Your mood</span>
          <strong>{localLabel}</strong>
          <small>{percent(localIntensity)} intensity</small>
        </div>
        <div>
          <span>Their mood</span>
          <strong>{remoteLabel}</strong>
          <small>{hasRemoteMood ? `${percent(remoteIntensity)} intensity` : "No live mood yet"}</small>
        </div>
      </div>
    </section>
  );
}
