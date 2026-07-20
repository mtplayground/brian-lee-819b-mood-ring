use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use serde::Serialize;

use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct HealthResponse {
    status: &'static str,
    database: &'static str,
}

pub async fn health_check(State(state): State<AppState>) -> impl IntoResponse {
    let database = if state.db.is_closed() { "closed" } else { "ready" };

    (
        StatusCode::OK,
        Json(HealthResponse {
            status: "ok",
            database,
        }),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::to_bytes;

    #[tokio::test]
    async fn health_check_returns_ok_payload() {
        let state = AppState::new(
            sqlx::PgPool::connect_lazy("postgres://example").expect("lazy pool"),
        );
        let response = health_check(State(state)).await.into_response();
        assert_eq!(response.status(), StatusCode::OK);

        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("health body");
        let payload: serde_json::Value = serde_json::from_slice(&body).expect("json body");

        assert_eq!(payload["status"], "ok");
        assert_eq!(payload["database"], "ready");
    }
}
