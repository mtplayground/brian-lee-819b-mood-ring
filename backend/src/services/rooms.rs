use std::{error::Error, fmt};

use mood_ring_backend::domain::{
    participant::{
        Participant, ParticipantId, ParticipantIdentityKey, ParticipantModelError,
        ParticipantSlot, ThemeId, DEFAULT_THEME_ID,
    },
    room::{Room, RoomId},
};
use sqlx::PgPool;
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Clone, Debug, PartialEq)]
pub struct CreatedRoom {
    pub room: Room,
    pub creator: Participant,
}

#[derive(Debug)]
pub enum RoomServiceError {
    Database(sqlx::Error),
    InvalidParticipant(ParticipantModelError),
}

impl fmt::Display for RoomServiceError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Database(error) => {
                write!(formatter, "database error while creating room: {error}")
            }
            Self::InvalidParticipant(error) => {
                write!(formatter, "invalid participant data while creating room: {error}")
            }
        }
    }
}

impl Error for RoomServiceError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::Database(error) => Some(error),
            Self::InvalidParticipant(error) => Some(error),
        }
    }
}

impl From<sqlx::Error> for RoomServiceError {
    fn from(error: sqlx::Error) -> Self {
        Self::Database(error)
    }
}

impl From<ParticipantModelError> for RoomServiceError {
    fn from(error: ParticipantModelError) -> Self {
        Self::InvalidParticipant(error)
    }
}

pub async fn create_room(pool: &PgPool) -> Result<CreatedRoom, RoomServiceError> {
    let creator_identity_key = ParticipantIdentityKey::new(generate_identity_key())?;
    let mut transaction = pool.begin().await?;

    let (room_id, room_created_at, room_updated_at): (Uuid, OffsetDateTime, OffsetDateTime) =
        sqlx::query_as(
            r#"
            INSERT INTO rooms DEFAULT VALUES
            RETURNING id, created_at, updated_at
            "#,
        )
        .fetch_one(&mut *transaction)
        .await?;

    let (
        participant_id,
        participant_room_id,
        participant_slot,
        identity_key,
        last_used_theme_id,
        participant_created_at,
        participant_updated_at,
    ): (Uuid, Uuid, i16, String, String, OffsetDateTime, OffsetDateTime) = sqlx::query_as(
        r#"
        INSERT INTO participants (room_id, slot, identity_key, last_used_theme_id)
        VALUES ($1, $2, $3, $4)
        RETURNING id, room_id, slot, identity_key, last_used_theme_id, created_at, updated_at
        "#,
    )
    .bind(room_id)
    .bind(ParticipantSlot::First.number())
    .bind(creator_identity_key.as_str())
    .bind(DEFAULT_THEME_ID)
    .fetch_one(&mut *transaction)
    .await?;

    transaction.commit().await?;

    Ok(CreatedRoom {
        room: Room::new(RoomId::new(room_id), room_created_at, room_updated_at),
        creator: Participant {
            id: ParticipantId::new(participant_id),
            room_id: RoomId::new(participant_room_id),
            slot: ParticipantSlot::from_number(participant_slot)?,
            identity_key: ParticipantIdentityKey::new(identity_key)?,
            latest_mood: None,
            last_used_theme_id: ThemeId::new(last_used_theme_id)?,
            created_at: participant_created_at,
            updated_at: participant_updated_at,
        },
    })
}

pub fn generate_identity_key() -> String {
    Uuid::new_v4().simple().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generated_identity_key_is_valid_and_unguessable_length() {
        let key = generate_identity_key();
        let identity_key = ParticipantIdentityKey::new(key.clone()).expect("identity key");

        assert_eq!(key.len(), 32);
        assert_eq!(identity_key.as_str(), key);
    }
}
