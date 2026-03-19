from __future__ import annotations

from passlib.context import CryptContext

# Windows/离线环境下 bcrypt 后端经常不稳定；MVP 使用纯 Python 的 PBKDF2 方案更稳。
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)

