use std::{env, error::Error, net::SocketAddr, time::Duration};

use futures_util::{SinkExt, Stream, StreamExt};
use reqwest::Client;
use serde_json::{json, Value};
use tokio::{net::TcpListener, task::JoinHandle, time::timeout};
use tokio_tungstenite::tungstenite::Message;
use uuid::Uuid;

use crate::{config::AppConfig, db, server, state::AppState};

type TestResult<T> = Result<T, Box<dyn Error + Send + Sync>>;

struct TestServer {
    addr: SocketAddr,
    handle: JoinHandle<()>,
}

impl Drop for TestServer {
    fn drop(&mut self) {
        self.handle.abort();
    }
}

#[tokio::test]
async fn core_loop_create_join_live_postcard_and_theme_restore() -> TestResult<()> {
    let Some(database_url) = database_url_for_e2e() else {
        eprintln!("skipping e2e core loop test: DATABASE_URL is not set");
        return Ok(());
    };

    let server = spawn_test_server(database_url).await?;
    let http_base_url = format!("http://{}", server.addr);
    let ws_base_url = format!("ws://{}", server.addr);
    let client = Client::new();

    let created_room = client
        .post(format!("{http_base_url}/api/rooms"))
        .send()
        .await?
        .error_for_status()?
        .json::<Value>()
        .await?;
    let room_id = created_room["roomId"]
        .as_str()
        .ok_or("create room response did not include roomId")?;
    let first_participant = created_room["creatorParticipant"].clone();
    let first_participant_id = participant_field(&first_participant, "participantId")?;
    let first_identity_key = participant_field(&first_participant, "identityKey")?;

    let joined_room = client
        .post(format!("{http_base_url}/api/rooms/{room_id}/join"))
        .json(&json!({}))
        .send()
        .await?
        .error_for_status()?
        .json::<Value>()
        .await?;
    let second_participant = joined_room["participant"].clone();
    let second_participant_id = participant_field(&second_participant, "participantId")?;
    let second_identity_key = participant_field(&second_participant, "identityKey")?;

    client
        .put(format!(
            "{http_base_url}/api/rooms/{room_id}/participants/{second_participant_id}/theme-preference"
        ))
        .json(&json!({
            "identityKey": second_identity_key,
            "themeId": "retro",
        }))
        .send()
        .await?
        .error_for_status()?;

    let first_ws_url = room_ws_url(
        &ws_base_url,
        room_id,
        &first_participant_id,
        &first_identity_key,
    );
    let second_ws_url = room_ws_url(
        &ws_base_url,
        room_id,
        &second_participant_id,
        &second_identity_key,
    );
    let (mut first_socket, _) = tokio_tungstenite::connect_async(first_ws_url).await?;
    let (mut second_socket, _) = tokio_tungstenite::connect_async(second_ws_url).await?;

    wait_for_socket_event(&mut first_socket, |event| {
        event["type"] == "presenceSnapshot"
            && event["participants"].as_array().is_some_and(|participants| {
                participants.iter().any(|participant| {
                    participant["participantId"] == first_participant_id
                }) && participants.iter().any(|participant| {
                    participant["participantId"] == second_participant_id
                })
            })
    })
    .await?;

    first_socket
        .send(Message::Text(
            mood_update_message("bright", 0.86, None, Some(("charged", 0.42)))
                .to_string()
                .into(),
        ))
        .await?;
    let first_mood_on_second = wait_for_participant_mood(
        &mut second_socket,
        &first_participant_id,
        "bright",
    )
    .await?;
    assert_json_number_close(
        &first_mood_on_second["payload"]["mood"]["blend"]["amount"],
        0.42,
    )?;

    second_socket
        .send(Message::Text(
            mood_update_message("tender", 0.64, Some("still thinking"), None)
                .to_string()
                .into(),
        ))
        .await?;
    let second_mood_on_first = wait_for_participant_mood(
        &mut first_socket,
        &second_participant_id,
        "tender",
    )
    .await?;
    assert_eq!(
        second_mood_on_first["payload"]["mood"]["value"]["note"],
        "still thinking"
    );

    drop(second_socket);

    wait_for_socket_event(&mut first_socket, |event| {
        event["type"] == "presenceSnapshot"
            && event["participants"].as_array().is_some_and(|participants| {
                participants.len() == 1
                    && participants[0]["participantId"] == first_participant_id
            })
    })
    .await?;

    let postcard_snapshot = client
        .get(format!(
            "{http_base_url}/api/rooms/{room_id}/participants/{first_participant_id}/latest-snapshot"
        ))
        .header("X-Participant-Identity-Key", first_identity_key)
        .send()
        .await?
        .error_for_status()?
        .json::<Value>()
        .await?;
    assert_eq!(postcard_snapshot["participantId"], second_participant_id);
    assert_eq!(postcard_snapshot["snapshot"]["mood"]["presetId"], "tender");
    assert_eq!(
        postcard_snapshot["snapshot"]["mood"]["note"],
        "still thinking"
    );

    let restored_second = client
        .post(format!("{http_base_url}/api/rooms/{room_id}/join"))
        .json(&json!({
            "identityKey": second_identity_key,
        }))
        .send()
        .await?
        .error_for_status()?
        .json::<Value>()
        .await?;
    assert_eq!(restored_second["restoredIdentity"], true);
    assert_eq!(
        restored_second["participant"]["participantId"],
        second_participant_id
    );
    assert_eq!(restored_second["participant"]["lastUsedThemeId"], "retro");

    Ok(())
}

async fn spawn_test_server(database_url: String) -> TestResult<TestServer> {
    let mut config = AppConfig {
        host: "127.0.0.1".to_owned(),
        port: 0,
        database_url,
        database_max_connections: 5,
        allowed_cors_origin: None,
        frontend_dist_dir: "../frontend/dist".into(),
    };
    let pool = match db::connect(&config).await {
        Ok(pool) => pool,
        Err(error)
            if should_retry_e2e_database_without_ssl(&error, &config.database_url) =>
        {
            config.database_url = config
                .database_url
                .replace("sslmode=require", "sslmode=disable");
            db::connect(&config).await?
        }
        Err(error) => return Err(error.into()),
    };
    db::run_migrations(&pool).await?;
    let state = AppState::new(pool);
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let addr = listener.local_addr()?;
    let app = server::build_router(config, state);
    let handle = tokio::spawn(async move {
        if let Err(error) = axum::serve(listener, app).await {
            eprintln!("e2e server exited with error: {error}");
        }
    });

    Ok(TestServer { addr, handle })
}

async fn wait_for_participant_mood<S>(
    stream: &mut S,
    participant_id: &str,
    preset_id: &str,
) -> TestResult<Value>
where
    S: Stream<Item = Result<Message, tokio_tungstenite::tungstenite::Error>> + Unpin,
{
    wait_for_socket_event(stream, |event| {
        event["type"] == "participantMessage"
            && event["participantId"] == participant_id
            && event["payload"]["type"] == "moodUpdate"
            && event["payload"]["mood"]["value"]["presetId"] == preset_id
    })
    .await
}

async fn wait_for_socket_event<S, F>(stream: &mut S, mut predicate: F) -> TestResult<Value>
where
    S: Stream<Item = Result<Message, tokio_tungstenite::tungstenite::Error>> + Unpin,
    F: FnMut(&Value) -> bool,
{
    loop {
        let message = timeout(Duration::from_secs(5), stream.next())
            .await
            .map_err(|_| "timed out waiting for websocket event")?
            .ok_or("websocket closed while waiting for event")??;

        if !message.is_text() {
            continue;
        }

        let text = message.into_text()?;
        let event: Value = serde_json::from_str(text.as_ref())?;

        if predicate(&event) {
            return Ok(event);
        }
    }
}

fn database_url_for_e2e() -> Option<String> {
    env::var("E2E_DATABASE_URL")
        .or_else(|_| env::var("DATABASE_URL"))
        .ok()
        .filter(|value| !value.trim().is_empty())
}

fn should_retry_e2e_database_without_ssl(error: &sqlx::Error, database_url: &str) -> bool {
    database_url.contains("sslmode=require")
        && error
            .to_string()
            .contains("unexpected response from SSLRequest")
}

fn participant_field(participant: &Value, field: &'static str) -> TestResult<String> {
    participant[field]
        .as_str()
        .map(ToOwned::to_owned)
        .ok_or_else(|| format!("participant response did not include {field}").into())
}

fn assert_json_number_close(value: &Value, expected: f64) -> TestResult<()> {
    let actual = value.as_f64().ok_or("expected JSON number")?;

    if (actual - expected).abs() > 0.001 {
        return Err(format!("expected {actual} to be within 0.001 of {expected}").into());
    }

    Ok(())
}

fn room_ws_url(
    ws_base_url: &str,
    room_id: &str,
    participant_id: &str,
    identity_key: &str,
) -> String {
    format!(
        "{ws_base_url}/api/rooms/{room_id}/ws?participantId={participant_id}&identityKey={identity_key}"
    )
}

fn mood_update_message(
    preset_id: &str,
    intensity: f32,
    note: Option<&str>,
    blend: Option<(&str, f32)>,
) -> Value {
    let value = match note {
        Some(note) => json!({
            "presetId": preset_id,
            "intensity": intensity,
            "note": note,
        }),
        None => json!({
            "presetId": preset_id,
            "intensity": intensity,
        }),
    };
    let blend_value = blend.map(|(adjacent_preset_id, amount)| {
        json!({
            "adjacentPresetId": adjacent_preset_id,
            "amount": amount,
        })
    });

    json!({
        "type": "moodUpdate",
        "mood": {
            "value": value,
            "selectedPreset": preset_definition(preset_id),
            "adjacentPreset": blend
                .map(|(adjacent_preset_id, _)| preset_definition(adjacent_preset_id)),
            "blend": blend_value,
            "blendDialValue": 74,
            "updatedAt": "2026-07-21T00:00:00Z",
        },
    })
}

fn preset_definition(preset_id: &str) -> Value {
    json!({
        "id": preset_id,
        "label": preset_id,
        "shorthand": "e2e mood",
        "signature": {
            "coreColor": "#5eead4",
            "accentColor": "#38bdf8",
            "ambientColor": "#111827",
            "energy": 0.6,
            "softness": 0.5,
            "clarity": 0.7,
            "motion": "pulse",
            "texture": "glass",
        },
    })
}

#[test]
fn generated_room_ws_url_uses_api_room_prefix() {
    let participant_id = Uuid::new_v4().to_string();
    let identity_key = Uuid::new_v4().simple().to_string();
    let room_id = Uuid::new_v4().to_string();

    let url = room_ws_url("ws://127.0.0.1:8080", &room_id, &participant_id, &identity_key);

    assert!(url.starts_with("ws://127.0.0.1:8080/api/rooms/"));
    assert!(url.contains("/ws?participantId="));
    assert!(url.contains("&identityKey="));
}
