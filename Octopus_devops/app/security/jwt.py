from __future__ import annotations

import datetime as dt
import secrets
from dataclasses import dataclass
from typing import Any, Literal

from jose import jwt

from app.core.config import settings


TokenType = Literal["access", "refresh"]


@dataclass(frozen=True)
class TokenPair:
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _encode(payload: dict[str, Any]) -> str:
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_alg)


def create_token(*, subject: str, token_type: TokenType, expires_delta: dt.timedelta) -> tuple[str, str, dt.datetime]:
    jti = secrets.token_hex(16)
    exp = _now() + expires_delta
    payload: dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        "jti": jti,
        "iat": int(_now().timestamp()),
        "exp": exp,
    }
    return _encode(payload), jti, exp


def create_token_pair(username: str) -> tuple[TokenPair, dict[str, Any]]:
    access_token, access_jti, access_exp = create_token(
        subject=username,
        token_type="access",
        expires_delta=dt.timedelta(minutes=settings.access_token_expire_minutes),
    )
    refresh_token, refresh_jti, refresh_exp = create_token(
        subject=username,
        token_type="refresh",
        expires_delta=dt.timedelta(days=settings.refresh_token_expire_days),
    )
    meta = {
        "access": {"jti": access_jti, "exp": access_exp},
        "refresh": {"jti": refresh_jti, "exp": refresh_exp},
    }
    return TokenPair(access_token=access_token, refresh_token=refresh_token), meta


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_alg])

