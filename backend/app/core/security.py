import json
import time
from dataclasses import dataclass
from uuid import UUID

import httpx
import jwt
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError, PyJWK

from app.core.config import get_settings

bearer_scheme = HTTPBearer(auto_error=False)
_jwks_cache: dict[str, object] = {"expires_at": 0.0, "keys": []}


@dataclass(frozen=True)
class AuthenticatedUser:
    id: UUID
    email: str | None
    role: str | None
    claims: dict


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
) -> AuthenticatedUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token.",
        )

    payload = await verify_supabase_jwt(credentials.credentials)
    subject = payload.get("sub")
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is missing a subject.",
        )

    try:
        user_id = UUID(subject)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token subject is not a valid user id.",
        ) from exc

    return AuthenticatedUser(
        id=user_id,
        email=payload.get("email"),
        role=payload.get("role"),
        claims=payload,
    )


async def verify_supabase_jwt(token: str) -> dict:
    settings = get_settings()
    audience = settings.supabase_jwt_audience or None
    decode_options = {"verify_aud": bool(audience)}

    try:
        if settings.supabase_jwt_secret:
            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256", "HS384", "HS512"],
                audience=audience,
                issuer=settings.supabase_auth_issuer,
                options=decode_options,
            )
        else:
            header = jwt.get_unverified_header(token)
            key = await _get_jwks_signing_key(str(header.get("kid")))
            payload = jwt.decode(
                token,
                key,
                algorithms=[str(header.get("alg", "RS256"))],
                audience=audience,
                issuer=settings.supabase_auth_issuer,
                options=decode_options,
            )
    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        ) from exc

    if payload.get("role") not in {None, "authenticated"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Token role is not allowed.",
        )

    return payload


async def _get_jwks_signing_key(kid: str) -> object:
    keys = await _get_cached_jwks()
    for key_data in keys:
        if key_data.get("kid") == kid:
            return PyJWK.from_json(json.dumps(key_data)).key

    # Rotate quickly if Supabase has changed signing keys.
    _jwks_cache["expires_at"] = 0.0
    keys = await _get_cached_jwks()
    for key_data in keys:
        if key_data.get("kid") == kid:
            return PyJWK.from_json(json.dumps(key_data)).key

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="JWT signing key was not found.",
    )


async def _get_cached_jwks() -> list[dict]:
    settings = get_settings()
    now = time.time()
    if _jwks_cache["expires_at"] > now:
        return list(_jwks_cache["keys"])

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(settings.supabase_jwks_url)
        response.raise_for_status()
        jwks = response.json()

    keys = jwks.get("keys", [])
    _jwks_cache["keys"] = keys
    _jwks_cache["expires_at"] = now + 3600
    return keys
