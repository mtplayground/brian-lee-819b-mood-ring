use std::{env, fmt, net::SocketAddr, path::PathBuf};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AppConfig {
    pub host: String,
    pub port: u16,
    pub database_url: String,
    pub allowed_cors_origin: Option<String>,
    pub frontend_dist_dir: PathBuf,
}

#[derive(Debug, PartialEq, Eq)]
pub enum ConfigError {
    MissingRequiredEnv { key: &'static str },
    InvalidPort { value: String },
}

impl fmt::Display for ConfigError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::MissingRequiredEnv { key } => {
                write!(formatter, "missing required environment variable {key}")
            }
            Self::InvalidPort { value } => {
                write!(formatter, "PORT must be a valid TCP port, got {value:?}")
            }
        }
    }
}

impl std::error::Error for ConfigError {}

impl AppConfig {
    pub fn from_env() -> Result<Self, ConfigError> {
        let host = env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_owned());
        let port = parse_port(env::var("PORT").ok())?;
        let database_url = required_env("DATABASE_URL")?;
        let allowed_cors_origin = optional_env("ALLOWED_CORS_ORIGIN");
        let frontend_dist_dir = optional_env("FRONTEND_DIST_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("frontend/dist"));

        Ok(Self {
            host,
            port,
            database_url,
            allowed_cors_origin,
            frontend_dist_dir,
        })
    }

    pub fn socket_addr(&self) -> Result<SocketAddr, std::net::AddrParseError> {
        format!("{}:{}", self.host, self.port).parse()
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
}
