use std::str::FromStr;

use sqlx::{
    migrate::Migrator,
    postgres::{PgConnectOptions, PgPoolOptions},
    PgPool,
};

use crate::config::AppConfig;

static MIGRATOR: Migrator = sqlx::migrate!("./migrations");

pub async fn connect(config: &AppConfig) -> Result<PgPool, sqlx::Error> {
    let connect_options = PgConnectOptions::from_str(&config.database_url)?
        .statement_cache_capacity(0);

    PgPoolOptions::new()
        .max_connections(config.database_max_connections)
        .connect_with(connect_options)
        .await
}

pub async fn run_migrations(pool: &PgPool) -> Result<(), sqlx::migrate::MigrateError> {
    MIGRATOR.run(pool).await
}

pub async fn check_connectivity(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query("SELECT 1").execute(pool).await?;
    Ok(())
}
