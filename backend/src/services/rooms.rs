use std::{error::Error, fmt};

use mood_ring_backend::domain::{
    mood::MoodValue,
    participant::{
        Participant, ParticipantId, ParticipantIdentityKey, ParticipantModelError,
        ParticipantMoodSnapshot, ParticipantSlot, ThemeId, DEFAULT_THEME_ID,
    },
    room::{Room, RoomId},
};
use sqlx::{types::Json, PgPool, Postgres, Transaction};
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Clone, Debug, PartialEq)]
pub struct CreatedRoom {
    pub room: Room,
    pub creator: Participant,
}

#[derive(Clone, Debug, PartialEq)]
pub struct JoinedRoom {
    pub room: Room,
    pub participant: Participant,
    pub restored_identity: bool,
}

#[derive(Debug)]
pub enum RoomServiceError {
    Database(sqlx::Error),
    InvalidParticipant(ParticipantModelError),
    RoomNotFound,
    RoomFull,
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
            Self::RoomNotFound => write!(formatter, "room was not found"),
            Self::RoomFull => write!(formatter, "room already has two participants"),
        }
    }
}

impl Error for RoomServiceError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::Database(error) => Some(error),
            Self::InvalidParticipant(error) => Some(error),
            Self::RoomNotFound | Self::RoomFull => None,
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

pub async fn join_room(
    pool: &PgPool,
    room_id: RoomId,
    provided_identity_key: Option<ParticipantIdentityKey>,
) -> Result<JoinedRoom, RoomServiceError> {
    let mut transaction = pool.begin().await?;
    let room = lock_room(&mut transaction, room_id).await?;

    if let Some(identity_key) = provided_identity_key.as_ref() {
        if let Some(participant) =
            fetch_participant_by_identity(&mut transaction, room_id, identity_key).await?
        {
            transaction.commit().await?;
            return Ok(JoinedRoom {
                room,
                participant,
                restored_identity: true,
            });
        }
    }

    if room_has_second_participant(&mut transaction, room_id).await? {
        return Err(RoomServiceError::RoomFull);
    }

    let identity_key = match provided_identity_key {
        Some(identity_key) => identity_key,
        None => ParticipantIdentityKey::new(generate_identity_key())?,
    };
    let participant = insert_participant(
        &mut transaction,
        room_id,
        ParticipantSlot::Second,
        &identity_key,
    )
    .await?;

    transaction.commit().await?;

    Ok(JoinedRoom {
        room,
        participant,
        restored_identity: false,
    })
}

pub fn generate_identity_key() -> String {
    Uuid::new_v4().simple().to_string()
}

type ParticipantRow = (
    Uuid,
    Uuid,
    i16,
    String,
    Option<Json<MoodValue>>,
    Option<OffsetDateTime>,
    String,
    OffsetDateTime,
    OffsetDateTime,
);

async fn lock_room(
    transaction: &mut Transaction<'_, Postgres>,
    room_id: RoomId,
) -> Result<Room, RoomServiceError> {
    let room: Option<(Uuid, OffsetDateTime, OffsetDateTime)> = sqlx::query_as(
        r#"
        SELECT id, created_at, updated_at
        FROM rooms
        WHERE id = $1
        FOR UPDATE
        "#,
    )
    .bind(room_id.value())
    .fetch_optional(&mut **transaction)
    .await?;

    match room {
        Some((id, created_at, updated_at)) => {
            Ok(Room::new(RoomId::new(id), created_at, updated_at))
        }
        None => Err(RoomServiceError::RoomNotFound),
    }
}

async fn fetch_participant_by_identity(
    transaction: &mut Transaction<'_, Postgres>,
    room_id: RoomId,
    identity_key: &ParticipantIdentityKey,
) -> Result<Option<Participant>, RoomServiceError> {
    let row: Option<ParticipantRow> = sqlx::query_as(
        r#"
        SELECT
            id,
            room_id,
            slot,
            identity_key,
            latest_mood,
            latest_mood_updated_at,
            last_used_theme_id,
            created_at,
            updated_at
        FROM participants
        WHERE room_id = $1 AND identity_key = $2
        "#,
    )
    .bind(room_id.value())
    .bind(identity_key.as_str())
    .fetch_optional(&mut **transaction)
    .await?;

    row.map(participant_from_row).transpose()
}

async fn room_has_second_participant(
    transaction: &mut Transaction<'_, Postgres>,
    room_id: RoomId,
) -> Result<bool, sqlx::Error> {
    let second_slot: Option<(i16,)> = sqlx::query_as(
        r#"
        SELECT slot
        FROM participants
        WHERE room_id = $1 AND slot = $2
        FOR UPDATE
        "#,
    )
    .bind(room_id.value())
    .bind(ParticipantSlot::Second.number())
    .fetch_optional(&mut **transaction)
    .await?;

    Ok(second_slot.is_some())
}

async fn insert_participant(
    transaction: &mut Transaction<'_, Postgres>,
    room_id: RoomId,
    slot: ParticipantSlot,
    identity_key: &ParticipantIdentityKey,
) -> Result<Participant, RoomServiceError> {
    let row: ParticipantRow = sqlx::query_as(
        r#"
        INSERT INTO participants (room_id, slot, identity_key, last_used_theme_id)
        VALUES ($1, $2, $3, $4)
        RETURNING
            id,
            room_id,
            slot,
            identity_key,
            latest_mood,
            latest_mood_updated_at,
            last_used_theme_id,
            created_at,
            updated_at
        "#,
    )
    .bind(room_id.value())
    .bind(slot.number())
    .bind(identity_key.as_str())
    .bind(DEFAULT_THEME_ID)
    .fetch_one(&mut **transaction)
    .await?;

    participant_from_row(row)
}

fn participant_from_row(row: ParticipantRow) -> Result<Participant, RoomServiceError> {
    let (
        id,
        room_id,
        slot,
        identity_key,
        latest_mood,
        latest_mood_updated_at,
        last_used_theme_id,
        created_at,
        updated_at,
    ) = row;

    let latest_mood = match (latest_mood, latest_mood_updated_at) {
        (Some(Json(mood)), Some(updated_at)) => {
            Some(ParticipantMoodSnapshot::new(mood, updated_at))
        }
        _ => None,
    };

    Ok(Participant {
        id: ParticipantId::new(id),
        room_id: RoomId::new(room_id),
        slot: ParticipantSlot::from_number(slot)?,
        identity_key: ParticipantIdentityKey::new(identity_key)?,
        latest_mood,
        last_used_theme_id: ThemeId::new(last_used_theme_id)?,
        created_at,
        updated_at,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use mood_ring_backend::domain::mood::{MoodIntensity, MoodPresetId};

    #[test]
    fn generated_identity_key_is_valid_and_unguessable_length() {
        let key = generate_identity_key();
        let identity_key = ParticipantIdentityKey::new(key.clone()).expect("identity key");

        assert_eq!(key.len(), 32);
        assert_eq!(identity_key.as_str(), key);
    }

    #[test]
    fn participant_from_row_restores_latest_mood_snapshot() {
        let now = OffsetDateTime::UNIX_EPOCH;
        let mood = MoodValue::new(
            MoodPresetId::new("calm").expect("preset id"),
            MoodIntensity::new(0.5).expect("intensity"),
            None,
        );
        let row = (
            Uuid::new_v4(),
            Uuid::new_v4(),
            ParticipantSlot::Second.number(),
            "stable-key".to_owned(),
            Some(Json(mood)),
            Some(now),
            DEFAULT_THEME_ID.to_owned(),
            now,
            now,
        );

        let participant = participant_from_row(row).expect("participant");

        assert_eq!(participant.slot, ParticipantSlot::Second);
        assert_eq!(participant.identity_key.as_str(), "stable-key");
        assert!(participant.latest_mood.is_some());
    }

    #[test]
    fn room_full_error_is_distinct() {
        assert_eq!(RoomServiceError::RoomFull.to_string(), "room already has two participants");
    }
}
