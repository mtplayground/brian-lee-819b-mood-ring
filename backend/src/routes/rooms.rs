use axum::{
    extract::{Path, State},
    http::HeaderMap,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use mood_ring_backend::domain::{
    participant::{ParticipantId, ParticipantIdentityKey, ParticipantSlot, ThemeId},
    room::RoomId,
};
use serde::{Deserialize, Serialize};
use tracing::error;

use crate::{services::rooms as room_service, state::AppState};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRoomResponse {
    pub room_id: RoomId,
    pub shareable_identifier: RoomId,
    pub share_path: String,
    pub creator_participant: ParticipantIdentityResponse,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParticipantIdentityResponse {
    pub participant_id: ParticipantId,
    pub identity_key: ParticipantIdentityKey,
    pub slot: ParticipantSlot,
    pub last_used_theme_id: ThemeId,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JoinRoomRequest {
    pub identity_key: Option<ParticipantIdentityKey>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JoinRoomResponse {
    pub room_id: RoomId,
    pub shareable_identifier: RoomId,
    pub share_path: String,
    pub participant: ParticipantIdentityResponse,
    pub restored_identity: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemePreferenceRequest {
    pub identity_key: ParticipantIdentityKey,
    pub theme_id: ThemeId,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemePreferenceResponse {
    pub participant_id: ParticipantId,
    pub theme_id: ThemeId,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: time::OffsetDateTime,
}

#[derive(Debug, Serialize)]
struct ErrorResponse {
    error: &'static str,
}

pub async fn create_room(State(state): State<AppState>) -> impl IntoResponse {
    match room_service::create_room(&state.db).await {
        Ok(created_room) => {
            let response = create_room_response(created_room);
            (StatusCode::CREATED, Json(response)).into_response()
        }
        Err(error) => {
            error!(%error, "failed to create room");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "room_create_failed",
                }),
            )
                .into_response()
        }
    }
}

pub async fn join_room(
    Path(room_id): Path<uuid::Uuid>,
    State(state): State<AppState>,
    Json(request): Json<JoinRoomRequest>,
) -> impl IntoResponse {
    let room_id = RoomId::new(room_id);

    match room_service::join_room(&state.db, room_id, request.identity_key).await {
        Ok(joined_room) => {
            let response = join_room_response(joined_room);
            (StatusCode::OK, Json(response)).into_response()
        }
        Err(room_service::RoomServiceError::RoomNotFound) => (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "room_not_found",
            }),
        )
            .into_response(),
        Err(room_service::RoomServiceError::RoomFull) => (
            StatusCode::CONFLICT,
            Json(ErrorResponse { error: "room_full" }),
        )
            .into_response(),
        Err(error) => {
            error!(%error, "failed to join room");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "room_join_failed",
                }),
            )
                .into_response()
        }
    }
}

pub async fn get_theme_preference(
    Path((room_id, participant_id)): Path<(uuid::Uuid, uuid::Uuid)>,
    State(state): State<AppState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let Some(identity_key) = identity_key_from_headers(&headers) else {
        return (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "missing_identity_key",
            }),
        )
            .into_response();
    };

    match room_service::get_participant_theme_preference(
        &state.db,
        RoomId::new(room_id),
        ParticipantId::new(participant_id),
        identity_key,
    )
    .await
    {
        Ok(preference) => {
            (StatusCode::OK, Json(theme_preference_response(preference))).into_response()
        }
        Err(room_service::RoomServiceError::ParticipantNotFound) => (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "participant_not_found",
            }),
        )
            .into_response(),
        Err(error) => {
            error!(%error, "failed to read participant theme preference");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "theme_preference_read_failed",
                }),
            )
                .into_response()
        }
    }
}

pub async fn update_theme_preference(
    Path((room_id, participant_id)): Path<(uuid::Uuid, uuid::Uuid)>,
    State(state): State<AppState>,
    Json(request): Json<ThemePreferenceRequest>,
) -> impl IntoResponse {
    if !is_supported_theme_id(&request.theme_id) {
        return (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "unsupported_theme_id",
            }),
        )
            .into_response();
    }

    match room_service::update_participant_theme_preference(
        &state.db,
        RoomId::new(room_id),
        ParticipantId::new(participant_id),
        request.identity_key,
        request.theme_id,
    )
    .await
    {
        Ok(preference) => {
            (StatusCode::OK, Json(theme_preference_response(preference))).into_response()
        }
        Err(room_service::RoomServiceError::ParticipantNotFound) => (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "participant_not_found",
            }),
        )
            .into_response(),
        Err(error) => {
            error!(%error, "failed to update participant theme preference");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "theme_preference_update_failed",
                }),
            )
                .into_response()
        }
    }
}

fn create_room_response(created_room: room_service::CreatedRoom) -> CreateRoomResponse {
    let room_id = created_room.room.id;

    CreateRoomResponse {
        room_id,
        shareable_identifier: room_id,
        share_path: format!("/rooms/{}", room_id.value()),
        creator_participant: participant_identity_response(created_room.creator),
    }
}

fn join_room_response(joined_room: room_service::JoinedRoom) -> JoinRoomResponse {
    let room_id = joined_room.room.id;

    JoinRoomResponse {
        room_id,
        shareable_identifier: room_id,
        share_path: format!("/rooms/{}", room_id.value()),
        participant: participant_identity_response(joined_room.participant),
        restored_identity: joined_room.restored_identity,
    }
}

fn participant_identity_response(
    participant: mood_ring_backend::domain::participant::Participant,
) -> ParticipantIdentityResponse {
    ParticipantIdentityResponse {
        participant_id: participant.id,
        identity_key: participant.identity_key,
        slot: participant.slot,
        last_used_theme_id: participant.last_used_theme_id,
    }
}

fn theme_preference_response(
    preference: room_service::ParticipantThemePreference,
) -> ThemePreferenceResponse {
    ThemePreferenceResponse {
        participant_id: preference.participant_id,
        theme_id: preference.theme_id,
        updated_at: preference.updated_at,
    }
}

fn identity_key_from_headers(headers: &HeaderMap) -> Option<ParticipantIdentityKey> {
    headers
        .get("x-participant-identity-key")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| ParticipantIdentityKey::new(value).ok())
}

fn is_supported_theme_id(theme_id: &ThemeId) -> bool {
    matches!(
        theme_id.as_str(),
        "organic" | "geometric" | "painterly" | "retro"
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use mood_ring_backend::domain::{
        participant::{Participant, ThemeId},
        room::Room,
    };
    use time::OffsetDateTime;

    #[test]
    fn create_room_response_contains_shareable_identifier_and_creator_identity() {
        let now = OffsetDateTime::UNIX_EPOCH;
        let room_id = RoomId::generate();
        let participant_id = ParticipantId::generate();
        let identity_key = ParticipantIdentityKey::new("creator-key").expect("identity key");
        let created_room = room_service::CreatedRoom {
            room: Room::new(room_id, now, now),
            creator: Participant {
                id: participant_id,
                room_id,
                slot: ParticipantSlot::First,
                identity_key,
                latest_mood: None,
                last_used_theme_id: ThemeId::default(),
                created_at: now,
                updated_at: now,
            },
        };

        let response = create_room_response(created_room);
        let json = serde_json::to_value(response).expect("response json");

        assert_eq!(json["roomId"], room_id.value().to_string());
        assert_eq!(json["shareableIdentifier"], room_id.value().to_string());
        assert_eq!(json["sharePath"], format!("/rooms/{}", room_id.value()));
        assert_eq!(
            json["creatorParticipant"]["participantId"],
            participant_id.value().to_string()
        );
        assert_eq!(json["creatorParticipant"]["identityKey"], "creator-key");
        assert_eq!(json["creatorParticipant"]["slot"], "first");
        assert_eq!(json["creatorParticipant"]["lastUsedThemeId"], "organic");
    }

    #[test]
    fn join_room_response_marks_restored_identity() {
        let now = OffsetDateTime::UNIX_EPOCH;
        let room_id = RoomId::generate();
        let participant_id = ParticipantId::generate();
        let identity_key = ParticipantIdentityKey::new("returning-key").expect("identity key");
        let joined_room = room_service::JoinedRoom {
            room: Room::new(room_id, now, now),
            participant: Participant {
                id: participant_id,
                room_id,
                slot: ParticipantSlot::Second,
                identity_key,
                latest_mood: None,
                last_used_theme_id: ThemeId::default(),
                created_at: now,
                updated_at: now,
            },
            restored_identity: true,
        };

        let response = join_room_response(joined_room);
        let json = serde_json::to_value(response).expect("response json");

        assert_eq!(json["roomId"], room_id.value().to_string());
        assert_eq!(json["participant"]["participantId"], participant_id.value().to_string());
        assert_eq!(json["participant"]["identityKey"], "returning-key");
        assert_eq!(json["participant"]["slot"], "second");
        assert_eq!(json["participant"]["lastUsedThemeId"], "organic");
        assert_eq!(json["restoredIdentity"], true);
    }

    #[test]
    fn theme_preference_response_uses_camel_case_payload() {
        let now = OffsetDateTime::UNIX_EPOCH;
        let participant_id = ParticipantId::generate();
        let preference = room_service::ParticipantThemePreference {
            participant_id,
            theme_id: ThemeId::new("retro").expect("theme id"),
            updated_at: now,
        };

        let response = theme_preference_response(preference);
        let json = serde_json::to_value(response).expect("response json");

        assert_eq!(json["participantId"], participant_id.value().to_string());
        assert_eq!(json["themeId"], "retro");
        assert!(json["updatedAt"].is_string());
    }

    #[test]
    fn unsupported_theme_ids_are_rejected_before_persistence() {
        assert!(is_supported_theme_id(&ThemeId::new("organic").expect("theme id")));
        assert!(!is_supported_theme_id(&ThemeId::new("unknown").expect("theme id")));
    }
}
