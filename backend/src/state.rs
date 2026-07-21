use sqlx::PgPool;

use crate::services::realtime::RoomChannelRegistry;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub room_channels: RoomChannelRegistry,
}

impl AppState {
    pub fn new(db: PgPool) -> Self {
        Self {
            db,
            room_channels: RoomChannelRegistry::default(),
        }
    }
}
