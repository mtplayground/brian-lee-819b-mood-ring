use std::{collections::HashMap, sync::Arc};

use mood_ring_backend::domain::room::RoomId;
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

#[derive(Clone, Default)]
pub struct RoomChannelRegistry {
    rooms: Arc<RwLock<HashMap<RoomId, broadcast::Sender<RoomChannelMessage>>>>,
}

impl RoomChannelRegistry {
    pub async fn join(&self, room_id: RoomId) -> RoomChannel {
        let mut rooms = self.rooms.write().await;
        let sender = rooms
            .entry(room_id)
            .or_insert_with(|| {
                let (sender, _receiver) = broadcast::channel(ROOM_CHANNEL_CAPACITY);
                sender
            })
            .clone();
        let receiver = sender.subscribe();

        RoomChannel { sender, receiver }
    }

    pub async fn remove_if_empty(&self, room_id: RoomId) {
        let mut rooms = self.rooms.write().await;

        if rooms
            .get(&room_id)
            .is_some_and(|sender| sender.receiver_count() == 0)
        {
            rooms.remove(&room_id);
        }
    }

    #[cfg(test)]
    pub async fn active_room_count(&self) -> usize {
        self.rooms.read().await.len()
    }
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
}
