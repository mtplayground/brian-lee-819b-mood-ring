mod config;
mod db;
mod routes;
mod server;
mod state;

use config::AppConfig;
use state::AppState;
use tokio::net::TcpListener;
use tracing::{error, info};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

#[tokio::main]
async fn main() {
    init_tracing();

    if let Err(error) = run().await {
        error!(%error, "backend exited with an error");
        std::process::exit(1);
    }
}

async fn run() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let config = AppConfig::from_env()?;
    let addr = config.socket_addr()?;

    info!(
        %addr,
        database_url = config.redacted_database_url(),
        database_max_connections = config.database_max_connections,
        allowed_cors_origin = config.allowed_cors_origin.as_deref().unwrap_or("not configured"),
        frontend_dist_dir = %config.frontend_dist_dir.display(),
        "starting backend"
    );

    let pool = db::connect(&config).await?;
    db::run_migrations(&pool).await?;
    db::check_connectivity(&pool).await?;
    info!("database connection pool is ready");

    let app_state = AppState::new(pool);
    let listener = TcpListener::bind(addr).await?;
    axum::serve(listener, server::build_router(config, app_state))
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

fn init_tracing() {
    let env_filter =
        EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info,tower_http=info"));

    tracing_subscriber::registry()
        .with(env_filter)
        .with(tracing_subscriber::fmt::layer().compact())
        .init();
}

async fn shutdown_signal() {
    let ctrl_c = async {
        if let Err(error) = tokio::signal::ctrl_c().await {
            error!(%error, "failed to install Ctrl+C shutdown handler");
        }
    };

    #[cfg(unix)]
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut signal) => {
                signal.recv().await;
            }
            Err(error) => {
                error!(%error, "failed to install terminate shutdown handler");
                std::future::pending::<()>().await;
            }
        }
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        () = ctrl_c => {},
        () = terminate => {},
    }

    info!("shutdown signal received");
}
