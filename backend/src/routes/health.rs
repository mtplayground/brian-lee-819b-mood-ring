use axum::{http::StatusCode, response::IntoResponse, Json};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct HealthResponse {
    status: &'static str,
}

pub async fn health_check() -> impl IntoResponse {
    (StatusCode::OK, Json(HealthResponse { status: "ok" }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::to_bytes;

    #[tokio::test]
    async fn health_check_returns_ok_payload() {
        let response = health_check().await.into_response();
        assert_eq!(response.status(), StatusCode::OK);

        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("health body");
        let payload: serde_json::Value = serde_json::from_slice(&body).expect("json body");

        assert_eq!(payload["status"], "ok");
    }
}
