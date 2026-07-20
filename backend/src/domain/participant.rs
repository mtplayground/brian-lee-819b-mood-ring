use std::{error::Error, fmt};

use serde::{de, Deserialize, Deserializer, Serialize, Serializer};
use time::OffsetDateTime;
use uuid::Uuid;

use crate::domain::{mood::MoodValue, room::RoomId};

pub const MAX_PARTICIPANT_IDENTITY_KEY_LENGTH: usize = 128;
pub const MAX_THEME_ID_LENGTH: usize = 64;
pub const DEFAULT_THEME_ID: &str = "organic";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct ParticipantId(Uuid);

impl ParticipantId {
    pub fn new(id: Uuid) -> Self {
        Self(id)
    }

    pub fn generate() -> Self {
        Self(Uuid::new_v4())
    }

    pub fn value(self) -> Uuid {
        self.0
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ParticipantSlot {
    First,
    Second,
}

impl ParticipantSlot {
    pub fn number(self) -> i16 {
        match self {
            Self::First => 1,
            Self::Second => 2,
        }
    }

    pub fn from_number(value: i16) -> Result<Self, ParticipantModelError> {
        match value {
            1 => Ok(Self::First),
            2 => Ok(Self::Second),
            _ => Err(ParticipantModelError::InvalidSlot { value }),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct ParticipantIdentityKey(String);

impl ParticipantIdentityKey {
    pub fn new(value: impl Into<String>) -> Result<Self, ParticipantModelError> {
        let value = value.into().trim().to_owned();

        if value.is_empty() {
            return Err(ParticipantModelError::EmptyIdentityKey);
        }

        if value.len() > MAX_PARTICIPANT_IDENTITY_KEY_LENGTH {
            return Err(ParticipantModelError::IdentityKeyTooLong {
                max: MAX_PARTICIPANT_IDENTITY_KEY_LENGTH,
                actual: value.len(),
            });
        }

        Ok(Self(value))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl Serialize for ParticipantIdentityKey {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        self.0.serialize(serializer)
    }
}

impl<'de> Deserialize<'de> for ParticipantIdentityKey {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let value = String::deserialize(deserializer)?;
        Self::new(value).map_err(de::Error::custom)
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct ThemeId(String);

impl ThemeId {
    pub fn new(value: impl Into<String>) -> Result<Self, ParticipantModelError> {
        let value = value.into().trim().to_owned();

        if value.is_empty() {
            return Err(ParticipantModelError::EmptyThemeId);
        }

        if value.len() > MAX_THEME_ID_LENGTH {
            return Err(ParticipantModelError::ThemeIdTooLong {
                max: MAX_THEME_ID_LENGTH,
                actual: value.len(),
            });
        }

        if !value
            .chars()
            .all(|character| {
                character.is_ascii_alphanumeric() || character == '-' || character == '_'
            })
        {
            return Err(ParticipantModelError::InvalidThemeId);
        }

        Ok(Self(value))
    }

    pub fn default_theme() -> Self {
        Self(DEFAULT_THEME_ID.to_owned())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl Default for ThemeId {
    fn default() -> Self {
        Self::default_theme()
    }
}

impl Serialize for ThemeId {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        self.0.serialize(serializer)
    }
}

impl<'de> Deserialize<'de> for ThemeId {
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
pub struct ParticipantMoodSnapshot {
    pub mood: MoodValue,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

impl ParticipantMoodSnapshot {
    pub fn new(mood: MoodValue, updated_at: OffsetDateTime) -> Self {
        Self { mood, updated_at }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Participant {
    pub id: ParticipantId,
    pub room_id: RoomId,
    pub slot: ParticipantSlot,
    pub identity_key: ParticipantIdentityKey,
    pub latest_mood: Option<ParticipantMoodSnapshot>,
    pub last_used_theme_id: ThemeId,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

#[derive(Clone, Debug, PartialEq)]
pub enum ParticipantModelError {
    InvalidSlot { value: i16 },
    EmptyIdentityKey,
    IdentityKeyTooLong { max: usize, actual: usize },
    EmptyThemeId,
    ThemeIdTooLong { max: usize, actual: usize },
    InvalidThemeId,
}

impl fmt::Display for ParticipantModelError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidSlot { value } => {
                write!(formatter, "participant slot must be 1 or 2, got {value}")
            }
            Self::EmptyIdentityKey => write!(formatter, "participant identity key cannot be empty"),
            Self::IdentityKeyTooLong { max, actual } => write!(
                formatter,
                "participant identity key must be at most {max} bytes, got {actual}"
            ),
            Self::EmptyThemeId => write!(formatter, "theme id cannot be empty"),
            Self::ThemeIdTooLong { max, actual } => {
                write!(formatter, "theme id must be at most {max} bytes, got {actual}")
            }
            Self::InvalidThemeId => write!(
                formatter,
                "theme id can only contain ASCII letters, numbers, hyphens, and underscores"
            ),
        }
    }
}

impl Error for ParticipantModelError {}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::mood::{MoodIntensity, MoodPresetId};

    #[test]
    fn participant_slot_maps_to_database_number() {
        assert_eq!(ParticipantSlot::First.number(), 1);
        assert_eq!(ParticipantSlot::Second.number(), 2);
        assert_eq!(ParticipantSlot::from_number(1), Ok(ParticipantSlot::First));
        assert_eq!(ParticipantSlot::from_number(2), Ok(ParticipantSlot::Second));
        assert!(ParticipantSlot::from_number(3).is_err());
    }

    #[test]
    fn participant_identity_key_is_trimmed_and_limited() {
        let key = ParticipantIdentityKey::new(" browser-key ").expect("identity key");
        let long_key = "x".repeat(MAX_PARTICIPANT_IDENTITY_KEY_LENGTH + 1);

        assert_eq!(key.as_str(), "browser-key");
        assert!(ParticipantIdentityKey::new("").is_err());
        assert!(ParticipantIdentityKey::new(long_key).is_err());
    }

    #[test]
    fn theme_id_uses_default_and_validates_identifier_shape() {
        assert_eq!(ThemeId::default().as_str(), DEFAULT_THEME_ID);
        assert!(ThemeId::new("minimal_grid").is_ok());
        assert!(ThemeId::new("not valid").is_err());
    }

    #[test]
    fn participant_serializes_with_latest_mood_snapshot() {
        let now = OffsetDateTime::UNIX_EPOCH;
        let mood = MoodValue::new(
            MoodPresetId::new("calm").expect("preset id"),
            MoodIntensity::new(0.4).expect("intensity"),
            None,
        );
        let participant = Participant {
            id: ParticipantId::generate(),
            room_id: RoomId::generate(),
            slot: ParticipantSlot::First,
            identity_key: ParticipantIdentityKey::new("stable").expect("identity key"),
            latest_mood: Some(ParticipantMoodSnapshot::new(mood, now)),
            last_used_theme_id: ThemeId::default(),
            created_at: now,
            updated_at: now,
        };

        let json = serde_json::to_value(participant).expect("participant json");

        assert_eq!(json["slot"], "first");
        assert_eq!(json["identityKey"], "stable");
        assert_eq!(json["lastUsedThemeId"], DEFAULT_THEME_ID);
        assert_eq!(json["latestMood"]["mood"]["presetId"], "calm");
    }
}
