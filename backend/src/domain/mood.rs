use std::{error::Error, fmt};

use serde::{de, Deserialize, Deserializer, Serialize, Serializer};

pub const MAX_PRESET_ID_LENGTH: usize = 64;
pub const MAX_NOTE_LENGTH: usize = 160;

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct MoodPresetId(String);

impl MoodPresetId {
    pub fn new(value: impl Into<String>) -> Result<Self, MoodValueError> {
        let value = value.into().trim().to_owned();

        if value.is_empty() {
            return Err(MoodValueError::EmptyPresetId);
        }

        if value.len() > MAX_PRESET_ID_LENGTH {
            return Err(MoodValueError::PresetIdTooLong {
                max: MAX_PRESET_ID_LENGTH,
                actual: value.len(),
            });
        }

        if !value
            .chars()
            .all(|character| {
                character.is_ascii_alphanumeric() || character == '-' || character == '_'
            })
        {
            return Err(MoodValueError::InvalidPresetId);
        }

        Ok(Self(value))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl Serialize for MoodPresetId {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        self.0.serialize(serializer)
    }
}

impl<'de> Deserialize<'de> for MoodPresetId {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let value = String::deserialize(deserializer)?;
        Self::new(value).map_err(de::Error::custom)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
pub struct MoodIntensity(f32);

impl MoodIntensity {
    pub fn new(value: f32) -> Result<Self, MoodValueError> {
        if !value.is_finite() {
            return Err(MoodValueError::InvalidIntensity);
        }

        if !(0.0..=1.0).contains(&value) {
            return Err(MoodValueError::IntensityOutOfRange { value });
        }

        Ok(Self(value))
    }

    pub fn value(self) -> f32 {
        self.0
    }
}

impl<'de> Deserialize<'de> for MoodIntensity {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let value = f32::deserialize(deserializer)?;
        Self::new(value).map_err(de::Error::custom)
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct MoodNote(String);

impl MoodNote {
    pub fn new(value: impl Into<String>) -> Result<Self, MoodValueError> {
        let value = value.into().trim().to_owned();

        if value.is_empty() {
            return Err(MoodValueError::EmptyNote);
        }

        let char_count = value.chars().count();
        if char_count > MAX_NOTE_LENGTH {
            return Err(MoodValueError::NoteTooLong {
                max: MAX_NOTE_LENGTH,
                actual: char_count,
            });
        }

        Ok(Self(value))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl Serialize for MoodNote {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        self.0.serialize(serializer)
    }
}

impl<'de> Deserialize<'de> for MoodNote {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let value = String::deserialize(deserializer)?;
        Self::new(value).map_err(de::Error::custom)
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoodValue {
    pub preset_id: MoodPresetId,
    pub intensity: MoodIntensity,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note: Option<MoodNote>,
}

impl MoodValue {
    pub fn new(
        preset_id: MoodPresetId,
        intensity: MoodIntensity,
        note: Option<MoodNote>,
    ) -> Self {
        Self {
            preset_id,
            intensity,
            note,
        }
    }
}

#[derive(Clone, Debug, PartialEq)]
pub enum MoodValueError {
    EmptyPresetId,
    PresetIdTooLong { max: usize, actual: usize },
    InvalidPresetId,
    InvalidIntensity,
    IntensityOutOfRange { value: f32 },
    EmptyNote,
    NoteTooLong { max: usize, actual: usize },
}

impl fmt::Display for MoodValueError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::EmptyPresetId => write!(formatter, "preset id cannot be empty"),
            Self::PresetIdTooLong { max, actual } => write!(
                formatter,
                "preset id must be at most {max} bytes, got {actual}"
            ),
            Self::InvalidPresetId => write!(
                formatter,
                "preset id can only contain ASCII letters, numbers, hyphens, and underscores"
            ),
            Self::InvalidIntensity => write!(formatter, "intensity must be a finite number"),
            Self::IntensityOutOfRange { value } => {
                write!(formatter, "intensity must be between 0 and 1, got {value}")
            }
            Self::EmptyNote => write!(formatter, "note cannot be empty"),
            Self::NoteTooLong { max, actual } => {
                write!(formatter, "note must be at most {max} characters, got {actual}")
            }
        }
    }
}

impl Error for MoodValueError {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mood_value_uses_canonical_json_shape() {
        let value = MoodValue::new(
            MoodPresetId::new("calm").expect("preset id"),
            MoodIntensity::new(0.75).expect("intensity"),
            Some(MoodNote::new("quiet focus").expect("note")),
        );

        let json = serde_json::to_value(value).expect("json value");

        assert_eq!(json["presetId"], "calm");
        assert_eq!(json["intensity"], 0.75);
        assert_eq!(json["note"], "quiet focus");
    }

    #[test]
    fn mood_value_allows_note_to_be_absent() {
        let value = MoodValue::new(
            MoodPresetId::new("bright").expect("preset id"),
            MoodIntensity::new(1.0).expect("intensity"),
            None,
        );

        let json = serde_json::to_value(value).expect("json value");

        assert!(json.get("note").is_none());
    }

    #[test]
    fn deserialization_rejects_invalid_intensity() {
        let result: Result<MoodValue, _> =
            serde_json::from_str(r#"{"presetId":"calm","intensity":1.1}"#);

        assert!(result.is_err());
    }

    #[test]
    fn preset_ids_are_trimmed_and_limited() {
        let preset_id = MoodPresetId::new(" calm ").expect("preset id");

        assert_eq!(preset_id.as_str(), "calm");
        assert!(MoodPresetId::new("not valid").is_err());
    }

    #[test]
    fn notes_are_optional_but_short_when_present() {
        let note = MoodNote::new(" centered ").expect("note");
        let long_note = "x".repeat(MAX_NOTE_LENGTH + 1);

        assert_eq!(note.as_str(), "centered");
        assert!(MoodNote::new("").is_err());
        assert!(MoodNote::new(long_note).is_err());
    }
}
