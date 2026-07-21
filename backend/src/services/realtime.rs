use std::{collections::HashMap, sync::Arc};

use mood_ring_backend::domain::{
    participant::{ParticipantId, ParticipantSlot},
    room::RoomId,
};
use serde::Serialize;
use tokio::sync::{broadcast, RwLock};

pub const ROOM_CHANNEL_CAPACITY: usize = 128;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RoomChannelMessage {
    pub payload: String,
}

impl RoomChannelMessage {
    pub fn new(payload: impl Into<String>) -> Self {
        Self {
            payload: payload.into(),
        }
    }
}

#[derive(Debug)]
pub struct RoomChannel {
    pub sender: broadcast::Sender<RoomChannelMessage>,
    pub receiver: broadcast::Receiver<RoomChannelMessage>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PresenceParticipant {
    pub participant_id: ParticipantId,
    pub slot: ParticipantSlot,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PresenceChange {
    pub participants: Vec<PresenceParticipant>,
    pub changed_presence: bool,
}

#[derive(Clone, Debug)]
struct PresenceEntry {
    participant: PresenceParticipant,
    connection_count: usize,
}

#[derive(Debug)]
struct RoomChannelState {
    sender: broadcast::Sender<RoomChannelMessage>,
    presence: HashMap<ParticipantId, PresenceEntry>,
}

#[derive(Clone, Default)]
pub struct RoomChannelRegistry {
    rooms: Arc<RwLock<HashMap<RoomId, RoomChannelState>>>,
}

impl RoomChannelRegistry {
    pub async fn join(&self, room_id: RoomId) -> RoomChannel {
        let mut rooms = self.rooms.write().await;
        let sender = rooms
            .entry(room_id)
            .or_insert_with(|| {
                let (sender, _receiver) = broadcast::channel(ROOM_CHANNEL_CAPACITY);
                RoomChannelState {
                    sender,
                    presence: HashMap::new(),
                }
            })
            .sender
            .clone();
        let receiver = sender.subscribe();

        RoomChannel { sender, receiver }
    }

    pub async fn connect_participant(
        &self,
        room_id: RoomId,
        participant_id: ParticipantId,
        slot: ParticipantSlot,
    ) -> PresenceChange {
        let mut rooms = self.rooms.write().await;
        let state = rooms.entry(room_id).or_insert_with(|| {
            let (sender, _receiver) = broadcast::channel(ROOM_CHANNEL_CAPACITY);
            RoomChannelState {
                sender,
                presence: HashMap::new(),
            }
        });

        let changed_presence = match state.presence.get_mut(&participant_id) {
            Some(entry) => {
                entry.connection_count += 1;
                false
            }
            None => {
                state.presence.insert(
                    participant_id,
                    PresenceEntry {
                        participant: PresenceParticipant {
                            participant_id,
                            slot,
                        },
                        connection_count: 1,
                    },
                );
                true
            }
        };

        PresenceChange {
            participants: presence_participants(state),
            changed_presence,
        }
    }

    pub async fn disconnect_participant(
        &self,
        room_id: RoomId,
        participant_id: ParticipantId,
    ) -> PresenceChange {
        let mut rooms = self.rooms.write().await;
        let Some(state) = rooms.get_mut(&room_id) else {
            return PresenceChange {
                participants: Vec::new(),
                changed_presence: false,
            };
        };

        let changed_presence = match state.presence.get_mut(&participant_id) {
            Some(entry) if entry.connection_count > 1 => {
                entry.connection_count -= 1;
                false
            }
            Some(_) => {
                state.presence.remove(&participant_id);
                true
            }
            None => false,
        };

        PresenceChange {
            participants: presence_participants(state),
            changed_presence,
        }
    }

    pub async fn remove_if_empty(&self, room_id: RoomId) {
        let mut rooms = self.rooms.write().await;

        if rooms
            .get(&room_id)
            .is_some_and(|state| state.sender.receiver_count() == 0 && state.presence.is_empty())
        {
            rooms.remove(&room_id);
        }
    }

    #[cfg(test)]
    pub async fn active_room_count(&self) -> usize {
        self.rooms.read().await.len()
    }
}

fn presence_participants(state: &RoomChannelState) -> Vec<PresenceParticipant> {
    let mut participants = state
        .presence
        .values()
        .map(|entry| entry.participant.clone())
        .collect::<Vec<_>>();

    participants.sort_by_key(|participant| participant.slot.number());
    participants
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn registry_reuses_room_channel_for_same_room() {
        let registry = RoomChannelRegistry::default();
        let room_id = RoomId::generate();
        let first = registry.join(room_id).await;
        let mut second = registry.join(room_id).await;

        first
            .sender
            .send(RoomChannelMessage::new("hello"))
            .expect("send message");

        let received = second.receiver.recv().await.expect("receive message");

        assert_eq!(received.payload, "hello");
        assert_eq!(registry.active_room_count().await, 1);
    }

    #[tokio::test]
    async fn registry_removes_channel_when_no_receivers_remain() {
        let registry = RoomChannelRegistry::default();
        let room_id = RoomId::generate();
        let channel = registry.join(room_id).await;

        drop(channel.receiver);
        registry.remove_if_empty(room_id).await;

        assert_eq!(registry.active_room_count().await, 0);
    }

    #[tokio::test]
    async fn registry_tracks_presence_until_last_connection_leaves() {
        let registry = RoomChannelRegistry::default();
        let room_id = RoomId::generate();
        let participant_id = ParticipantId::generate();

        let first_connection = registry
            .connect_participant(room_id, participant_id, ParticipantSlot::First)
            .await;
        let second_connection = registry
            .connect_participant(room_id, participant_id, ParticipantSlot::First)
            .await;
        let first_disconnect = registry
            .disconnect_participant(room_id, participant_id)
            .await;
        let final_disconnect = registry
            .disconnect_participant(room_id, participant_id)
            .await;

        assert!(first_connection.changed_presence);
        assert_eq!(first_connection.participants.len(), 1);
        assert!(!second_connection.changed_presence);
        assert_eq!(second_connection.participants.len(), 1);
        assert!(!first_disconnect.changed_presence);
        assert_eq!(first_disconnect.participants.len(), 1);
        assert!(final_disconnect.changed_presence);
        assert!(final_disconnect.participants.is_empty());
    }
}
