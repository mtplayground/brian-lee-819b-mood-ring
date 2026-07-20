use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use mood_ring_backend::domain::{
    participant::{ParticipantId, ParticipantIdentityKey, ParticipantSlot},
    room::RoomId,
};
use serde::Serialize;
use tracing::error;

use crate::{services::rooms as room_service, state::AppState};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRoomResponse {
    pub room_id: RoomId,
    pub shareable_identifier: RoomId,
    pub share_path: String,
    pub creator_participant: CreatorParticipantResponse,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatorParticipantResponse {
    pub participant_id: ParticipantId,
    pub identity_key: ParticipantIdentityKey,
    pub slot: ParticipantSlot,
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

fn create_room_response(created_room: room_service::CreatedRoom) -> CreateRoomResponse {
    let room_id = created_room.room.id;

    CreateRoomResponse {
        room_id,
        shareable_identifier: room_id,
        share_path: format!("/rooms/{}", room_id.value()),
        creator_participant: CreatorParticipantResponse {
            participant_id: created_room.creator.id,
            identity_key: created_room.creator.identity_key,
            slot: created_room.creator.slot,
        },
    }
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
    }
}
