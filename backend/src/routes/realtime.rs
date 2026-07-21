use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, Query, State,
    },
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use futures_util::{SinkExt, StreamExt};
use mood_ring_backend::domain::{
    mood::MoodValue,
    participant::{Participant, ParticipantId, ParticipantIdentityKey, ParticipantSlot},
    room::RoomId,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::PgPool;
use tokio::sync::broadcast;
use tracing::{debug, warn};

use crate::{
    services::{
        realtime::{PresenceParticipant, RoomChannelMessage, RoomChannelRegistry},
        rooms as room_service,
    },
    state::AppState,
};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoomWebSocketQuery {
    pub participant_id: ParticipantId,
    pub identity_key: ParticipantIdentityKey,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase", tag = "type")]
enum RoomWebSocketEvent {
    ParticipantConnected {
        participant_id: ParticipantId,
        slot: ParticipantSlot,
    },
    ParticipantDisconnected {
        participant_id: ParticipantId,
        slot: ParticipantSlot,
    },
    ParticipantMessage {
        participant_id: ParticipantId,
        slot: ParticipantSlot,
        payload: Value,
    },
    PresenceSnapshot {
        participants: Vec<PresenceParticipant>,
    },
}

#[derive(Debug, Serialize)]
struct ErrorResponse {
    error: &'static str,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", tag = "type")]
enum ClientMoodMessage {
    MoodUpdate { mood: ClientMoodEnvelope },
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ClientMoodEnvelope {
    value: MoodValue,
}

pub async fn room_websocket(
    Path(room_id): Path<uuid::Uuid>,
    State(state): State<AppState>,
    Query(query): Query<RoomWebSocketQuery>,
    websocket: WebSocketUpgrade,
) -> impl IntoResponse {
    let room_id = RoomId::new(room_id);
    let participant = match room_service::authenticate_room_participant(
        &state.db,
        room_id,
        query.participant_id,
        query.identity_key,
    )
    .await
    {
        Ok(participant) => participant,
        Err(room_service::RoomServiceError::ParticipantNotFound) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(ErrorResponse {
                    error: "participant_auth_failed",
                }),
            )
                .into_response();
        }
        Err(error) => {
            warn!(%error, "failed to authenticate websocket participant");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "websocket_auth_failed",
                }),
            )
                .into_response();
        }
    };

    websocket
        .on_upgrade(move |socket| {
            handle_room_socket(socket, state.db, state.room_channels, room_id, participant)
        })
        .into_response()
}

async fn handle_room_socket(
    socket: WebSocket,
    db: PgPool,
    registry: RoomChannelRegistry,
    room_id: RoomId,
    participant: Participant,
) {
    let channel = registry.join(room_id).await;
    let (mut socket_sender, mut socket_receiver) = socket.split();
    let mut room_receiver = channel.receiver;
    let room_sender = channel.sender;
    let participant_id = participant.id;
    let participant_slot = participant.slot;
    let connected_presence = registry
        .connect_participant(room_id, participant_id, participant_slot)
        .await;

    if connected_presence.changed_presence {
        broadcast_event(
            &room_sender,
            RoomWebSocketEvent::ParticipantConnected {
                participant_id,
                slot: participant_slot,
            },
        );
    }
    broadcast_presence_snapshot(&room_sender, connected_presence.participants);

    loop {
        tokio::select! {
            room_message = room_receiver.recv() => {
                match room_message {
                    Ok(message) => {
                        if socket_sender.send(Message::Text(message.payload.into())).await.is_err() {
                            break;
                        }
                    }
                    Err(broadcast::error::RecvError::Lagged(skipped)) => {
                        debug!(%skipped, "websocket room receiver lagged");
                    }
                    Err(broadcast::error::RecvError::Closed) => break,
                }
            }
            socket_message = socket_receiver.next() => {
                match socket_message {
                    Some(Ok(Message::Text(text))) => {
                        let payload = client_payload_from_text(text.to_string());
                        persist_mood_snapshot_from_payload(
                            &db,
                            room_id,
                            participant_id,
                            &payload,
                        )
                        .await;
                        broadcast_event(
                            &room_sender,
                            RoomWebSocketEvent::ParticipantMessage {
                                participant_id,
                                slot: participant_slot,
                                payload,
                            },
                        );
                    }
                    Some(Ok(Message::Binary(_))) => {
                        debug!("ignoring binary websocket message");
                    }
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Ok(_)) => {}
                    Some(Err(error)) => {
                        debug!(%error, "websocket receive error");
                        break;
                    }
                }
            }
        }
    }

    let disconnected_presence = registry
        .disconnect_participant(room_id, participant_id)
        .await;
    if disconnected_presence.changed_presence {
        broadcast_event(
            &room_sender,
            RoomWebSocketEvent::ParticipantDisconnected {
                participant_id,
                slot: participant_slot,
            },
        );
    }
    broadcast_presence_snapshot(&room_sender, disconnected_presence.participants);
    drop(room_receiver);
    registry.remove_if_empty(room_id).await;
}

fn client_payload_from_text(text: String) -> Value {
    serde_json::from_str(&text).unwrap_or(Value::String(text))
}

async fn persist_mood_snapshot_from_payload(
    db: &PgPool,
    room_id: RoomId,
    participant_id: ParticipantId,
    payload: &Value,
) {
    let Some(snapshot) = mood_snapshot_from_client_payload(payload) else {
        return;
    };

    match snapshot {
        Ok(mood) => {
            if let Err(error) =
                room_service::update_participant_latest_mood(
                    db,
                    room_id,
                    participant_id,
                    Some(mood),
                )
                .await
            {
                warn!(%error, ?participant_id, ?room_id, "failed to persist latest mood snapshot");
            }
        }
        Err(error) => {
            warn!(%error, ?participant_id, ?room_id, "invalid mood snapshot payload");
        }
    }
}

fn mood_snapshot_from_client_payload(
    payload: &Value,
) -> Option<Result<MoodValue, serde_json::Error>> {
    let payload_type = payload.get("type").and_then(Value::as_str)?;

    match payload_type {
        "moodUpdate" => Some(
            serde_json::from_value::<ClientMoodMessage>(payload.clone()).map(|message| {
                match message {
                    ClientMoodMessage::MoodUpdate { mood } => mood.value,
                }
            }),
        ),
        _ => None,
    }
}

fn broadcast_event(
    sender: &broadcast::Sender<RoomChannelMessage>,
    event: RoomWebSocketEvent,
) {
    match serde_json::to_string(&event) {
        Ok(payload) => {
            let _ = sender.send(RoomChannelMessage::new(payload));
        }
        Err(error) => {
            warn!(%error, "failed to serialize websocket event");
        }
    }
}

fn broadcast_presence_snapshot(
    sender: &broadcast::Sender<RoomChannelMessage>,
    participants: Vec<PresenceParticipant>,
) {
    broadcast_event(sender, RoomWebSocketEvent::PresenceSnapshot { participants });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn websocket_event_serializes_with_camel_case_fields() {
        let participant_id = ParticipantId::generate();
        let event = RoomWebSocketEvent::ParticipantMessage {
            participant_id,
            slot: ParticipantSlot::Second,
            payload: serde_json::json!({ "kind": "mood-preview" }),
        };

        let value = serde_json::to_value(event).expect("event json");

        assert_eq!(value["type"], "participantMessage");
        assert_eq!(value["participantId"], participant_id.value().to_string());
        assert_eq!(value["slot"], "second");
        assert_eq!(value["payload"]["kind"], "mood-preview");
    }

    #[test]
    fn presence_snapshot_serializes_connected_participants() {
        let participant_id = ParticipantId::generate();
        let event = RoomWebSocketEvent::PresenceSnapshot {
            participants: vec![PresenceParticipant {
                participant_id,
                slot: ParticipantSlot::First,
            }],
        };

        let value = serde_json::to_value(event).expect("event json");

        assert_eq!(value["type"], "presenceSnapshot");
        assert_eq!(value["participants"][0]["participantId"], participant_id.value().to_string());
        assert_eq!(value["participants"][0]["slot"], "first");
    }

    #[test]
    fn plain_text_client_payload_is_preserved_as_string() {
        let payload = client_payload_from_text("hello".to_owned());

        assert_eq!(payload, Value::String("hello".to_owned()));
    }

    #[test]
    fn mood_update_payload_extracts_canonical_mood_value() {
        let payload = serde_json::json!({
            "type": "moodUpdate",
            "mood": {
                "value": {
                    "presetId": "calm",
                    "intensity": 0.75,
                    "note": "steady"
                },
                "selectedPreset": {},
                "blendDialValue": 50,
                "updatedAt": "2026-07-21T00:00:00Z"
            }
        });

        let snapshot = mood_snapshot_from_client_payload(&payload)
            .expect("mood message")
            .expect("valid mood");

        assert_eq!(snapshot.preset_id.as_str(), "calm");
        assert_eq!(snapshot.note.as_ref().map(|note| note.as_str()), Some("steady"));
    }

    #[test]
    fn mood_clear_payload_is_ignored_for_snapshot_persistence() {
        let payload = serde_json::json!({ "type": "moodClear" });

        assert!(mood_snapshot_from_client_payload(&payload).is_none());
    }
}
