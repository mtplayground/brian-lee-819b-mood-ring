use serde::Serialize;

use super::mood::MoodPresetId;

#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PresetMoodDefinition {
    pub id: &'static str,
    pub label: &'static str,
    pub shorthand: &'static str,
    pub signature: MoodSignature,
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MoodSignature {
    pub core_color: &'static str,
    pub accent_color: &'static str,
    pub ambient_color: &'static str,
    pub energy: f32,
    pub softness: f32,
    pub clarity: f32,
    pub motion: SignatureMotion,
    pub texture: SignatureTexture,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum SignatureMotion {
    Drift,
    Pulse,
    Bloom,
    Flicker,
    Sink,
    Scatter,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum SignatureTexture {
    Mist,
    Glass,
    Velvet,
    Spark,
    Grain,
    Static,
}

pub const PRESET_MOODS: [PresetMoodDefinition; 6] = [
    PresetMoodDefinition {
        id: "still",
        label: "Still",
        shorthand: "quiet, settled, low ripple",
        signature: MoodSignature {
            core_color: "#7dd3fc",
            accent_color: "#99f6e4",
            ambient_color: "#0f172a",
            energy: 0.18,
            softness: 0.82,
            clarity: 0.72,
            motion: SignatureMotion::Drift,
            texture: SignatureTexture::Mist,
        },
    },
    PresetMoodDefinition {
        id: "bright",
        label: "Bright",
        shorthand: "open, buoyant, clear edge",
        signature: MoodSignature {
            core_color: "#facc15",
            accent_color: "#38bdf8",
            ambient_color: "#172554",
            energy: 0.78,
            softness: 0.38,
            clarity: 0.9,
            motion: SignatureMotion::Pulse,
            texture: SignatureTexture::Glass,
        },
    },
    PresetMoodDefinition {
        id: "tender",
        label: "Tender",
        shorthand: "warm, close, soft bloom",
        signature: MoodSignature {
            core_color: "#f9a8d4",
            accent_color: "#fcd34d",
            ambient_color: "#3b1d31",
            energy: 0.42,
            softness: 0.92,
            clarity: 0.52,
            motion: SignatureMotion::Bloom,
            texture: SignatureTexture::Velvet,
        },
    },
    PresetMoodDefinition {
        id: "charged",
        label: "Charged",
        shorthand: "electric, eager, sharp pulse",
        signature: MoodSignature {
            core_color: "#fb7185",
            accent_color: "#22d3ee",
            ambient_color: "#1e1b4b",
            energy: 0.94,
            softness: 0.22,
            clarity: 0.82,
            motion: SignatureMotion::Flicker,
            texture: SignatureTexture::Spark,
        },
    },
    PresetMoodDefinition {
        id: "heavy",
        label: "Heavy",
        shorthand: "low, muted, slow weight",
        signature: MoodSignature {
            core_color: "#94a3b8",
            accent_color: "#a78bfa",
            ambient_color: "#111827",
            energy: 0.16,
            softness: 0.48,
            clarity: 0.34,
            motion: SignatureMotion::Sink,
            texture: SignatureTexture::Grain,
        },
    },
    PresetMoodDefinition {
        id: "restless",
        label: "Restless",
        shorthand: "jagged, searching, quick scatter",
        signature: MoodSignature {
            core_color: "#fb923c",
            accent_color: "#34d399",
            ambient_color: "#312e81",
            energy: 0.86,
            softness: 0.18,
            clarity: 0.46,
            motion: SignatureMotion::Scatter,
            texture: SignatureTexture::Static,
        },
    },
];

pub fn preset_moods() -> &'static [PresetMoodDefinition] {
    &PRESET_MOODS
}

pub fn is_preset_mood_id(preset_id: &MoodPresetId) -> bool {
    PRESET_MOODS
        .iter()
        .any(|preset| preset.id == preset_id.as_str())
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use super::*;

    #[test]
    fn preset_ids_are_valid_and_unique() {
        let mut ids = HashSet::new();

        for preset in preset_moods() {
            MoodPresetId::new(preset.id).expect("valid preset id");
            assert!(ids.insert(preset.id), "duplicate preset id {}", preset.id);
        }
    }

    #[test]
    fn preset_signatures_stay_in_theme_engine_range() {
        for preset in preset_moods() {
            assert!((0.0..=1.0).contains(&preset.signature.energy));
            assert!((0.0..=1.0).contains(&preset.signature.softness));
            assert!((0.0..=1.0).contains(&preset.signature.clarity));
            assert!(preset.signature.core_color.starts_with('#'));
            assert!(preset.signature.accent_color.starts_with('#'));
            assert!(preset.signature.ambient_color.starts_with('#'));
        }
    }

    #[test]
    fn preset_lookup_matches_canonical_mood_id() {
        let known_id = MoodPresetId::new("still").expect("preset id");
        let unknown_id = MoodPresetId::new("unknown").expect("preset id");

        assert!(is_preset_mood_id(&known_id));
        assert!(!is_preset_mood_id(&unknown_id));
    }
}
