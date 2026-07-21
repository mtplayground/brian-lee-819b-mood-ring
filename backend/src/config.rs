use std::{env, fmt, net::SocketAddr, path::PathBuf};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AppConfig {
    pub host: String,
    pub port: u16,
    pub database_url: String,
    pub database_max_connections: u32,
    pub allowed_cors_origin: Option<String>,
    pub frontend_dist_dir: PathBuf,
}

#[derive(Debug, PartialEq, Eq)]
pub enum ConfigError {
    MissingRequiredEnv { key: &'static str },
    MissingFrontendBuild { index_html: PathBuf },
    InvalidPort { value: String },
    InvalidDatabaseMaxConnections { value: String },
}

impl fmt::Display for ConfigError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::MissingRequiredEnv { key } => {
                write!(formatter, "missing required environment variable {key}")
            }
            Self::MissingFrontendBuild { index_html } => write!(
                formatter,
                "frontend build is missing at {}; run `npm --prefix frontend run build` or set FRONTEND_DIST_DIR",
                index_html.display()
            ),
            Self::InvalidPort { value } => {
                write!(formatter, "PORT must be a valid TCP port, got {value:?}")
            }
            Self::InvalidDatabaseMaxConnections { value } => write!(
                formatter,
                "DATABASE_MAX_CONNECTIONS must be a positive integer, got {value:?}"
            ),
        }
    }
}

impl std::error::Error for ConfigError {}

impl AppConfig {
    pub fn from_env() -> Result<Self, ConfigError> {
        let host = env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_owned());
        let port = parse_port(env::var("PORT").ok())?;
        let database_url = required_env("DATABASE_URL")?;
        let database_max_connections =
            parse_database_max_connections(env::var("DATABASE_MAX_CONNECTIONS").ok())?;
        let allowed_cors_origin = optional_env("ALLOWED_CORS_ORIGIN");
        let frontend_dist_dir = optional_env("FRONTEND_DIST_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("frontend/dist"));

        Ok(Self {
            host,
            port,
            database_url,
            database_max_connections,
            allowed_cors_origin,
            frontend_dist_dir,
        })
    }

    pub fn socket_addr(&self) -> Result<SocketAddr, std::net::AddrParseError> {
        format!("{}:{}", self.host, self.port).parse()
    }

    pub fn validate_frontend_build(&self) -> Result<(), ConfigError> {
        let index_html = self.frontend_dist_dir.join("index.html");

        if index_html.is_file() {
            Ok(())
        } else {
            Err(ConfigError::MissingFrontendBuild { index_html })
        }
    }

    pub fn redacted_database_url(&self) -> &'static str {
        if self.database_url.is_empty() {
            "missing"
        } else {
            "configured"
        }
    }
}

fn parse_port(raw_port: Option<String>) -> Result<u16, ConfigError> {
    match raw_port {
        Some(value) => value
            .parse::<u16>()
            .map_err(|_| ConfigError::InvalidPort { value }),
        None => Ok(8080),
    }
}

fn parse_database_max_connections(raw_value: Option<String>) -> Result<u32, ConfigError> {
    match raw_value {
        Some(value) => value
            .parse::<u32>()
            .ok()
            .filter(|connections| *connections > 0)
            .ok_or(ConfigError::InvalidDatabaseMaxConnections { value }),
        None => Ok(5),
    }
}

fn required_env(key: &'static str) -> Result<String, ConfigError> {
    env::var(key)
        .ok()
        .filter(|value| !value.trim().is_empty())
        .ok_or(ConfigError::MissingRequiredEnv { key })
}

fn optional_env(key: &'static str) -> Option<String> {
    env::var(key).ok().filter(|value| !value.trim().is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_port_defaults_to_8080() {
        assert_eq!(parse_port(None).expect("default port"), 8080);
    }

    #[test]
    fn parse_port_rejects_invalid_values() {
        assert_eq!(
            parse_port(Some("not-a-port".to_owned())),
            Err(ConfigError::InvalidPort {
                value: "not-a-port".to_owned()
            })
        );
    }

    #[test]
    fn parse_database_max_connections_defaults_to_5() {
        assert_eq!(
            parse_database_max_connections(None).expect("default connection count"),
            5
        );
    }

    #[test]
    fn parse_database_max_connections_rejects_zero() {
        assert_eq!(
            parse_database_max_connections(Some("0".to_owned())),
            Err(ConfigError::InvalidDatabaseMaxConnections {
                value: "0".to_owned()
            })
        );
    }

    #[test]
    fn validate_frontend_build_requires_index_html() {
        let config = AppConfig {
            host: "127.0.0.1".to_owned(),
            port: 8080,
            database_url: "postgres://example".to_owned(),
            database_max_connections: 5,
            allowed_cors_origin: None,
            frontend_dist_dir: PathBuf::from("definitely-missing-dist"),
        };

        assert_eq!(
            config.validate_frontend_build(),
            Err(ConfigError::MissingFrontendBuild {
                index_html: PathBuf::from("definitely-missing-dist/index.html")
            })
        );
    }
}
