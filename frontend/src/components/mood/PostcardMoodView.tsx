import type { CSSProperties } from "react";
import type { ClientMoodState } from "../../state/clientMood";
import type { CreativeThemeId } from "../../theme";
import { moodToThemeTokens } from "../../theme";

type PostcardMoodViewProps = {
  activeThemeId: CreativeThemeId;
  mood: ClientMoodState | null;
  snapshotUpdatedAt: string | null;
};

type PostcardMoodViewStyle = CSSProperties & {
  "--postcard-accent": string;
  "--postcard-ambient": string;
  "--postcard-core": string;
  "--postcard-duration": string;
  "--postcard-glow": string;
  "--postcard-intensity": string;
  "--postcard-motion": string;
  "--postcard-softness": string;
};

const percent = (value: number): string => `${Math.round(value * 100)}%`;

const relativeTime = (isoDate: string | null): string | null => {
  if (!isoDate) {
    return null;
  }

  const timestamp = Date.parse(isoDate);

  if (!Number.isFinite(timestamp)) {
    return null;
  }

  const elapsedMs = Date.now() - timestamp;
  const elapsedMinutes = Math.max(0, Math.round(elapsedMs / 60_000));

  if (elapsedMinutes < 1) {
    return "Just now";
  }

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} min ago`;
  }

  const elapsedHours = Math.round(elapsedMinutes / 60);

  if (elapsedHours < 24) {
    return `${elapsedHours} hr ago`;
  }

  return `${Math.round(elapsedHours / 24)} days ago`;
};

export function PostcardMoodView({
  activeThemeId,
  mood,
  snapshotUpdatedAt,
}: PostcardMoodViewProps) {
  const tokens = moodToThemeTokens(mood);
  const intensity = mood?.value.intensity ?? 0;
  const postcardStyle: PostcardMoodViewStyle = {
    "--postcard-accent": tokens.palette.accent,
    "--postcard-ambient": tokens.palette.ambient,
    "--postcard-core": tokens.palette.core,
    "--postcard-duration": `${tokens.motion.durationMs * 2}ms`,
    "--postcard-glow": tokens.palette.stageGlow,
    "--postcard-intensity": intensity.toFixed(3),
    "--postcard-motion": tokens.motion.amplitude.toFixed(3),
    "--postcard-softness": (0.62 + tokens.layout.rhythm * 0.14).toFixed(3),
  };
  const snapshotAge = relativeTime(snapshotUpdatedAt);
  const moodLabel = mood?.selectedPreset.label ?? "No postcard yet";
  const moodSummary = mood
    ? [
        `${percent(mood.value.intensity)} intensity`,
        mood.value.note || null,
        snapshotAge,
      ]
        .filter(Boolean)
        .join(" · ")
    : "The other person's saved mood will appear here after they share one.";

  return (
    <section
      className={`postcard-view postcard-view--${activeThemeId}`}
      aria-labelledby="postcard-heading"
      style={postcardStyle}
    >
      <div className="postcard-view__copy">
        <p className="route-panel__eyebrow">Postcard</p>
        <h2 id="postcard-heading">{moodLabel}</h2>
        <p>{moodSummary}</p>
      </div>

      <div className="postcard-view__scene" aria-hidden="true">
        <div className="postcard-view__wash postcard-view__wash--one" />
        <div className="postcard-view__wash postcard-view__wash--two" />
        <div className="postcard-view__mark" />
      </div>
    </section>
  );
}
