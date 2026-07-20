use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct RoomId(Uuid);

impl RoomId {
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

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Room {
    pub id: RoomId,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

impl Room {
    pub fn new(id: RoomId, created_at: OffsetDateTime, updated_at: OffsetDateTime) -> Self {
        Self {
            id,
            created_at,
            updated_at,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn room_id_serializes_as_uuid_string() {
        let id = RoomId::generate();
        let json = serde_json::to_value(id).expect("room id json");

        assert_eq!(json.as_str(), Some(id.value().to_string().as_str()));
    }
}
