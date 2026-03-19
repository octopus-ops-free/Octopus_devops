from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Octopus Ops MVP"
    env: str = "dev"
    log_level: str = "INFO"

    sqlite_path: str = "./data/octopus.db"

    jwt_secret: str = "change_me"
    jwt_alg: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    bootstrap_admin_username: str = "admin"
    bootstrap_admin_password: str = "admin123"

    def sqlite_file_path(self) -> Path:
        return Path(self.sqlite_path).expanduser().resolve()


settings = Settings()

