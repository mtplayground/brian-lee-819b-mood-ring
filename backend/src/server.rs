use axum::{
    routing::{get, post},
    Router,
};
use http::{HeaderValue, Method};
use tower_http::{
    cors::{Any, CorsLayer},
    services::{ServeDir, ServeFile},
    trace::TraceLayer,
};
use tracing::warn;

use crate::{
    config::AppConfig,
    routes::{
        health::health_check,
        realtime::room_websocket,
        rooms::{
            create_room, get_latest_snapshot, get_theme_preference, join_room,
            update_theme_preference,
        },
    },
    state::AppState,
};

pub fn build_router(config: AppConfig, state: AppState) -> Router {
    let static_service = ServeDir::new(&config.frontend_dist_dir)
        .not_found_service(ServeFile::new(config.frontend_dist_dir.join("index.html")));

    Router::new()
        .route("/health", get(health_check))
        .route("/api/rooms", post(create_room))
        .route("/api/rooms/{room_id}/join", post(join_room))
        .route("/api/rooms/{room_id}/ws", get(room_websocket))
        .route(
            "/api/rooms/{room_id}/participants/{participant_id}/theme-preference",
            get(get_theme_preference).put(update_theme_preference),
        )
        .route(
            "/api/rooms/{room_id}/participants/{participant_id}/latest-snapshot",
            get(get_latest_snapshot),
        )
        .fallback_service(static_service)
        .with_state(state)
        .layer(cors_layer(&config))
        .layer(TraceLayer::new_for_http())
}

fn cors_layer(config: &AppConfig) -> CorsLayer {
    let layer = CorsLayer::new()
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::PATCH, Method::DELETE])
        .allow_headers(Any);

    match config.allowed_cors_origin.as_deref() {
        Some(origin) => match HeaderValue::from_str(origin) {
            Ok(origin) => layer.allow_origin(origin),
            Err(error) => {
                warn!(%origin, %error, "ignoring invalid ALLOWED_CORS_ORIGIN");
                layer
            }
        },
        None => layer,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::{to_bytes, Body},
        http::{Request, StatusCode},
    };
    use tower::ServiceExt;

    fn test_config() -> AppConfig {
        AppConfig {
            host: "127.0.0.1".to_owned(),
            port: 8080,
            database_url: "postgres://example".to_owned(),
            database_max_connections: 5,
            allowed_cors_origin: Some("http://localhost:8080".to_owned()),
            frontend_dist_dir: "../frontend/dist".into(),
        }
    }

    #[tokio::test]
    async fn health_route_is_mounted() {
        let state = AppState::new(
            sqlx::PgPool::connect_lazy("postgres://example").expect("lazy pool"),
        );
        let response = build_router(test_config(), state)
            .oneshot(
                Request::builder()
                    .uri("/health")
                    .body(Body::empty())
                    .expect("request"),
            )
            .await
            .expect("response");

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("health body");
        let payload: serde_json::Value = serde_json::from_slice(&body).expect("json body");
        assert_eq!(payload["status"], "ok");
        assert_eq!(payload["database"], "ready");
    }

    #[tokio::test]
    async fn create_room_route_is_mounted_under_api_prefix() {
        let state = AppState::new(
            sqlx::PgPool::connect_lazy("postgres://example").expect("lazy pool"),
        );
        let response = build_router(test_config(), state)
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/rooms")
                    .body(Body::empty())
                    .expect("request"),
            )
            .await
            .expect("response");

        assert_ne!(response.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn join_room_route_is_mounted_under_api_prefix() {
        let state = AppState::new(
            sqlx::PgPool::connect_lazy("postgres://example").expect("lazy pool"),
        );
        let response = build_router(test_config(), state)
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/rooms/00000000-0000-4000-8000-000000000000/join")
                    .header("content-type", "application/json")
                    .body(Body::from("{}"))
                    .expect("request"),
            )
            .await
            .expect("response");

        assert_ne!(response.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn theme_preference_route_is_mounted_under_api_prefix() {
        let uri = concat!(
            "/api/rooms/00000000-0000-4000-8000-000000000000",
            "/participants/00000000-0000-4000-8000-000000000001/theme-preference"
        );
        let state = AppState::new(
            sqlx::PgPool::connect_lazy("postgres://example").expect("lazy pool"),
        );
        let response = build_router(test_config(), state)
            .oneshot(
                Request::builder()
                    .method("PUT")
                    .uri(uri)
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"identityKey":"stable-key","themeId":"organic"}"#))
                    .expect("request"),
            )
            .await
            .expect("response");

        assert_ne!(response.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn latest_snapshot_route_is_mounted_under_api_prefix() {
        let uri = concat!(
            "/api/rooms/00000000-0000-4000-8000-000000000000",
            "/participants/00000000-0000-4000-8000-000000000001/latest-snapshot"
        );
        let state = AppState::new(
            sqlx::PgPool::connect_lazy("postgres://example").expect("lazy pool"),
        );
        let response = build_router(test_config(), state)
            .oneshot(
                Request::builder()
                    .uri(uri)
                    .header("x-participant-identity-key", "stable-key")
                    .body(Body::empty())
                    .expect("request"),
            )
            .await
            .expect("response");

        assert_ne!(response.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn websocket_route_is_mounted_under_api_prefix() {
        let state = AppState::new(
            sqlx::PgPool::connect_lazy("postgres://example").expect("lazy pool"),
        );
        let response = build_router(test_config(), state)
            .oneshot(
                Request::builder()
                    .uri("/api/rooms/00000000-0000-4000-8000-000000000000/ws")
                    .body(Body::empty())
                    .expect("request"),
            )
            .await
            .expect("response");

        assert_ne!(response.status(), StatusCode::NOT_FOUND);
    }
}
